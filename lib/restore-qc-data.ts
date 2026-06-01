import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { seedMemberLogins } from '@/lib/seed-member-logins'
import { ensureDefaultTemplates } from '@/lib/sell-tasks'
import { createWatchTasks } from '@/lib/watch-tasks'

/** Known team roster — WhatsApp numbers recovered from prior production setup. */
const TEAM_MEMBERS = [
  { name: 'Master', whatsapp_number: '0000000000', department: 'LOGISTICS' as const, role: 'MASTER' as const },
  { name: 'Haris', whatsapp_number: '447836605913', department: 'LOGISTICS' as const, role: 'MEMBER' as const },
  { name: 'Hassan', whatsapp_number: '447909159899', department: 'ACCOUNTING' as const, role: 'MEMBER' as const },
  { name: 'Aleena', whatsapp_number: '85259366991', department: 'SALES' as const, role: 'MEMBER' as const },
  { name: 'Josh', whatsapp_number: '971581976310', department: 'SALES' as const, role: 'MEMBER' as const },
  { name: 'Hasnain Graphics', whatsapp_number: '923001234501', department: 'SALES' as const, role: 'MEMBER' as const },
  { name: 'Johny', whatsapp_number: '447710628345', department: 'LOGISTICS' as const, role: 'MEMBER' as const },
  { name: 'Ummay', whatsapp_number: '923001234502', department: 'ACCOUNTING' as const, role: 'MEMBER' as const },
  { name: 'Kash', whatsapp_number: '923001234503', department: 'SALES' as const, role: 'MEMBER' as const },
]

const TASK_ASSIGNMENT_DEFAULTS: Record<string, string> = {
  ACCOUNTING_MARK_PAYMENT: 'Hassan',
  ACCOUNTING_ADD_STOCK_FOB: 'Hassan',
  SALES_SET_PRICE: 'Aleena',
  SALES_UPLOAD_DRIVE: 'Hasnain Graphics',
  SALES_UPLOAD_STOCK_GROUP: 'Hasnain Graphics',
  SALES_UPDATE_B2B: 'Josh',
  SALES_GET_B2C_PRICES: 'Josh',
  LOGISTICS_SET_LOCATION: 'Haris',
  LOGISTICS_UPDATE_COST: 'Haris',
  LOGISTICS_ACCESSORIES: 'Haris',
}

const DEFAULT_SETTINGS: Record<string, string> = {
  greenapi_api_url: 'https://7107.api.green-api.com',
  auto_message_time: '08:00',
  reminder_interval_minutes: '180',
  whatsapp_stock_group_name: 'Purosangue team BUY AND SELL',
  whatsapp_stock_group_id: '120363420701421193@g.us',
}

type InventoryRow = {
  stock_no: string
  brand: string | null
  model: string | null
  ref_no: string | null
  serial_no: string | null
  bought_from: string | null
  purchase_price: number | null
  website_price: number | null
  watch_date: string | null
  payment_status: 'PAID' | 'PARTIAL' | 'NOT_PAID' | null
  image_url: string | null
  category: string | null
  fob_url: string | null
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

function pick(row: string[], idx: Map<string, number>, ...keys: string[]): string {
  for (const key of keys) {
    const i = idx.get(key)
    if (i == null) continue
    const v = (row[i] || '').trim()
    if (v) return v
  }
  return ''
}

function parseMoney(raw: string): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[£$€,\s]/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parsePaymentStatus(raw: string): 'PAID' | 'PARTIAL' | 'NOT_PAID' | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null
  if (/not\s*paid|unpaid|un\s*paid/.test(t)) return 'NOT_PAID'
  if (/partial/.test(t)) return 'PARTIAL'
  if (/paid/.test(t)) return 'PAID'
  return null
}

function loadActiveInventory(): InventoryRow[] {
  const filePath = path.join(process.cwd(), 'data', 'inventory_all.csv')
  if (!fs.existsSync(filePath)) return []

  const text = fs.readFileSync(filePath, 'utf8')
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0])
  const idx = new Map<string, number>()
  headers.forEach((h, i) => idx.set(h.trim(), i))

  const byStock = new Map<string, InventoryRow>()

  for (let li = 1; li < lines.length; li++) {
    const row = parseCsvLine(lines[li])
    const stockRaw = pick(row, idx, 'STOCK NUMBER', 'Stock No', 'Stock No.')
    if (!stockRaw) continue
    const stock_no = stockRaw.replace(/^#/, '').trim()
    if (!/^\d+$/.test(stock_no)) continue
    if (pick(row, idx, 'Sold Date')) continue

    const brand = pick(row, idx, 'Marca') || null
    if (!brand) continue

    const rec: InventoryRow = {
      stock_no,
      brand,
      model: pick(row, idx, 'Model', 'Modello') || null,
      ref_no: pick(row, idx, 'Referenza', 'Reference', 'Reference No') || null,
      serial_no: pick(row, idx, 'Serial Number') || null,
      bought_from: pick(row, idx, 'Purchased From', 'Supplier Name') || null,
      purchase_price: parseMoney(pick(row, idx, 'Purchase Price', 'Purchase Price (£)', 'Purchase Price (Â£)')),
      website_price: parseMoney(pick(row, idx, 'Website Price', 'Website Price (£)', 'Retail Price', 'Retail Price (£)')),
      watch_date: pick(row, idx, 'Watch Date') || null,
      payment_status: parsePaymentStatus(pick(row, idx, 'Payment Status')),
      image_url: pick(row, idx, 'Website Photo', 'Photo', 'PRODUCT PHOTO', 'Checkout Image') || null,
      category: pick(row, idx, 'Category') || null,
      fob_url: pick(row, idx, 'detail_url') || null,
    }

    const existing = byStock.get(stock_no)
    if (!existing || (rec.purchase_price ?? 0) > (existing.purchase_price ?? 0)) {
      byStock.set(stock_no, rec)
    }
  }

  return Array.from(byStock.values()).sort((a, b) => Number(b.stock_no) - Number(a.stock_no))
}

async function upsertSetting(key: string, value: string, onlyIfEmpty = true) {
  const existing = await prisma.setting.findUnique({ where: { key } })
  if (existing?.value && onlyIfEmpty) return false
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
  return true
}

async function restoreTeamMembers() {
  let created = 0
  let updated = 0

  for (const member of TEAM_MEMBERS) {
    const existing = await prisma.teamMember.findFirst({
      where: { name: { equals: member.name, mode: 'insensitive' } },
    })

    if (existing) {
      const needsUpdate =
        existing.whatsapp_number === '0000000000' && member.whatsapp_number !== '0000000000'
        || !existing.login_username
        || (member.role === 'MASTER' && existing.role !== 'MASTER')

      if (needsUpdate) {
        await prisma.teamMember.update({
          where: { id: existing.id },
          data: {
            whatsapp_number:
              existing.whatsapp_number === '0000000000' && member.whatsapp_number !== '0000000000'
                ? member.whatsapp_number
                : existing.whatsapp_number,
            department: member.department,
            role: member.role,
          },
        })
        updated++
      }
      continue
    }

    await prisma.teamMember.create({ data: member })
    created++
  }

  return { created, updated }
}

async function restoreSettings() {
  let updated = 0

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (await upsertSetting(key, value)) updated++
  }

  const instanceId = process.env.GREENAPI_INSTANCE_ID?.trim()
  const apiToken = process.env.GREENAPI_API_TOKEN?.trim()
  const apiUrl = process.env.GREENAPI_API_URL?.trim()
  if (instanceId && (await upsertSetting('greenapi_instance_id', instanceId))) updated++
  if (apiToken && (await upsertSetting('greenapi_api_token', apiToken))) updated++
  if (apiUrl && (await upsertSetting('greenapi_api_url', apiUrl))) updated++

  const defaultsRow = await prisma.setting.findUnique({ where: { key: 'task_assignment_defaults' } })
  const current = defaultsRow?.value?.trim()
  if (!current || current === '{}') {
    await upsertSetting('task_assignment_defaults', JSON.stringify(TASK_ASSIGNMENT_DEFAULTS), false)
    updated++
  }

  return updated
}

async function restoreWatches() {
  const existingCount = await prisma.watch.count()
  if (existingCount > 0) {
    return { imported: 0, skipped: true, reason: 'watches already exist' }
  }

  const rows = loadActiveInventory()
  if (rows.length === 0) {
    return { imported: 0, skipped: true, reason: 'no inventory CSV rows' }
  }

  let imported = 0
  for (const row of rows) {
    const nameParts = [row.brand, row.model].filter(Boolean)
    const name = nameParts.length > 0 ? nameParts.join(' ') : (row.ref_no || `Stock ${row.stock_no}`)
    const purchase = row.purchase_price ?? 0
    const website = row.website_price ?? (purchase > 0 ? purchase * 1.15 : 1000)
    const b2b = purchase > 0 ? purchase * 1.05 : website * 0.95

    const watch = await prisma.watch.create({
      data: {
        brand: row.brand,
        model: row.model,
        ref_no: row.ref_no,
        serial_no: row.serial_no,
        stock_no: row.stock_no,
        watch_date: row.watch_date,
        bought_from: row.bought_from,
        currency: 'GBP',
        purchase_price: purchase > 0 ? purchase : null,
        name,
        image_url: row.image_url,
        website_price: website,
        b2b_price: b2b,
        watch_type: 'BUY',
        payment_status: row.payment_status ?? 'NOT_PAID',
        location_status: 'INCOMING',
        location_to: row.category,
        fob_url: row.fob_url,
      },
    })

    await createWatchTasks(watch.id, watch.name, true)
    imported++
  }

  return { imported, skipped: false }
}

export type RestoreReport = {
  team: { created: number; updated: number }
  settingsUpdated: number
  watches: { imported: number; skipped: boolean; reason?: string }
  loginsSeeded: boolean
}

/** Idempotent restore for empty DB after Supabase migration. Safe to re-run. */
export async function restoreQcData(opts?: { forceWatches?: boolean }): Promise<RestoreReport> {
  const memberCount = await prisma.teamMember.count()
  const watchCount = await prisma.watch.count()
  const needsRestore = memberCount <= 1 || watchCount === 0

  if (!needsRestore && !opts?.forceWatches) {
    return {
      team: { created: 0, updated: 0 },
      settingsUpdated: 0,
      watches: { imported: 0, skipped: true, reason: 'data already present' },
      loginsSeeded: false,
    }
  }

  console.log('[restore] Starting QC data restore…')
  const team = await restoreTeamMembers()
  const settingsUpdated = await restoreSettings()
  await ensureDefaultTemplates()

  let watches: RestoreReport['watches']
  if (watchCount === 0 || opts?.forceWatches) {
    watches = await restoreWatches()
  } else {
    watches = { imported: 0, skipped: true, reason: 'watches already exist' }
  }

  await seedMemberLogins()
  console.log('[restore] Done:', { team, settingsUpdated, watches })

  return {
    team,
    settingsUpdated,
    watches,
    loginsSeeded: true,
  }
}
