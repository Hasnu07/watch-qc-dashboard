// Restore team members, settings, watches, and tasks after DB migration.
// Usage: node scripts/restore-qc-data.mjs
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

const TEAM_MEMBERS = [
  { name: 'Master', whatsapp_number: '0000000000', department: 'LOGISTICS', role: 'MASTER' },
  { name: 'Haris', whatsapp_number: '447836605913', department: 'LOGISTICS', role: 'MEMBER' },
  { name: 'Hassan', whatsapp_number: '447909159899', department: 'ACCOUNTING', role: 'MEMBER' },
  { name: 'Aleena', whatsapp_number: '85259366991', department: 'SALES', role: 'MEMBER' },
  { name: 'Josh', whatsapp_number: '971581976310', department: 'SALES', role: 'MEMBER' },
  { name: 'Hasnain Graphics', whatsapp_number: '923001234501', department: 'SALES', role: 'MEMBER' },
  { name: 'Johny', whatsapp_number: '447710628345', department: 'LOGISTICS', role: 'MEMBER' },
  { name: 'Ummay', whatsapp_number: '923001234502', department: 'ACCOUNTING', role: 'MEMBER' },
  { name: 'Kash', whatsapp_number: '923001234503', department: 'SALES', role: 'MEMBER' },
]

const TASK_ASSIGNMENT_DEFAULTS = {
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

const WATCH_TASKS = [
  { department: 'ACCOUNTING', task_type: 'ACCOUNTING_MARK_PAYMENT', is_locked: false },
  { department: 'ACCOUNTING', task_type: 'ACCOUNTING_ADD_STOCK_FOB', is_locked: false },
  { department: 'SALES', task_type: 'SALES_SET_PRICE', is_locked: false },
  { department: 'SALES', task_type: 'SALES_UPLOAD_DRIVE', is_locked: false },
  { department: 'SALES', task_type: 'SALES_UPLOAD_STOCK_GROUP', is_locked: false },
  { department: 'SALES', task_type: 'SALES_UPDATE_B2B', is_locked: false },
  { department: 'SALES', task_type: 'SALES_GET_B2C_PRICES', is_locked: false },
  { department: 'LOGISTICS', task_type: 'LOGISTICS_SET_LOCATION', is_locked: true },
  { department: 'LOGISTICS', task_type: 'LOGISTICS_UPDATE_COST', is_locked: false },
  { department: 'LOGISTICS', task_type: 'LOGISTICS_ACCESSORIES_BOX', is_locked: false },
  { department: 'LOGISTICS', task_type: 'LOGISTICS_ACCESSORIES_PAPERS', is_locked: false },
  { department: 'LOGISTICS', task_type: 'LOGISTICS_ACCESSORIES_EXTRA_LINKS', is_locked: false },
  { department: 'LOGISTICS', task_type: 'LOGISTICS_ACCESSORIES_WARRANTY_CARD', is_locked: false },
  { department: 'LOGISTICS', task_type: 'LOGISTICS_ACCESSORIES_HANG_TAG', is_locked: false },
]

const BUILTIN_ASSIGNEES = { SALES_UPLOAD_STOCK_GROUP: 'Hasnain Graphics' }

function hashPassword(username, password) {
  return crypto.createHash('sha256').update(`${username}:${password}:qc-salt`).digest('hex')
}

function memberPassword(name) {
  return `${name.trim()}@125`
}

function parseCsvLine(line) {
  const out = []
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

function pick(row, idx, ...keys) {
  for (const key of keys) {
    const i = idx.get(key)
    if (i == null) continue
    const v = (row[i] || '').trim()
    if (v) return v
  }
  return ''
}

function parseMoney(raw) {
  if (!raw) return null
  const cleaned = raw.replace(/[£$€,\s]/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) && n > 0 ? n : null
}

function loadActiveInventory() {
  const filePath = path.join(process.cwd(), 'data', 'inventory_all.csv')
  if (!fs.existsSync(filePath)) return []

  const text = fs.readFileSync(filePath, 'utf8')
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0])
  const idx = new Map(headers.map((h, i) => [h.trim(), i]))
  const byStock = new Map()

  for (let li = 1; li < lines.length; li++) {
    const row = parseCsvLine(lines[li])
    const stockRaw = pick(row, idx, 'STOCK NUMBER', 'Stock No', 'Stock No.')
    if (!stockRaw) continue
    const stock_no = stockRaw.replace(/^#/, '').trim()
    if (!/^\d+$/.test(stock_no)) continue
    if (pick(row, idx, 'Sold Date')) continue

    const brand = pick(row, idx, 'Marca') || null
    if (!brand) continue

    const rec = {
      stock_no,
      brand,
      model: pick(row, idx, 'Model', 'Modello') || null,
      ref_no: pick(row, idx, 'Referenza', 'Reference', 'Reference No') || null,
      serial_no: pick(row, idx, 'Serial Number') || null,
      bought_from: pick(row, idx, 'Purchased From', 'Supplier Name') || null,
      purchase_price: parseMoney(pick(row, idx, 'Purchase Price', 'Purchase Price (£)', 'Purchase Price (Â£)')),
      website_price: parseMoney(pick(row, idx, 'Website Price', 'Website Price (£)', 'Retail Price', 'Retail Price (£)')),
      watch_date: pick(row, idx, 'Watch Date') || null,
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

async function upsertSetting(key, value, onlyIfEmpty = true) {
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
      if (existing.whatsapp_number === '0000000000' && member.whatsapp_number !== '0000000000') {
        await prisma.teamMember.update({
          where: { id: existing.id },
          data: { whatsapp_number: member.whatsapp_number, department: member.department, role: member.role },
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
  const defaults = {
    greenapi_api_url: 'https://7107.api.green-api.com',
    auto_message_time: '08:00',
    reminder_interval_minutes: '180',
    whatsapp_stock_group_name: 'Purosangue team BUY AND SELL',
    whatsapp_stock_group_id: '120363420701421193@g.us',
  }
  for (const [key, value] of Object.entries(defaults)) {
    if (await upsertSetting(key, value)) updated++
  }
  if (process.env.GREENAPI_INSTANCE_ID && (await upsertSetting('greenapi_instance_id', process.env.GREENAPI_INSTANCE_ID))) updated++
  if (process.env.GREENAPI_API_TOKEN && (await upsertSetting('greenapi_api_token', process.env.GREENAPI_API_TOKEN))) updated++
  if (process.env.GREENAPI_API_URL && (await upsertSetting('greenapi_api_url', process.env.GREENAPI_API_URL))) updated++

  const row = await prisma.setting.findUnique({ where: { key: 'task_assignment_defaults' } })
  if (!row?.value || row.value === '{}') {
    await upsertSetting('task_assignment_defaults', JSON.stringify(TASK_ASSIGNMENT_DEFAULTS), false)
    updated++
  }
  return updated
}

function resolveAssignee(taskType, dept, taskDefaults, membersByDept) {
  if (taskDefaults[taskType]) return taskDefaults[taskType]
  if (taskType.startsWith('LOGISTICS_ACCESSORIES') && taskDefaults.LOGISTICS_ACCESSORIES) {
    return taskDefaults.LOGISTICS_ACCESSORIES
  }
  if (BUILTIN_ASSIGNEES[taskType]) return BUILTIN_ASSIGNEES[taskType]
  return membersByDept[dept] ?? null
}

async function getTaskDefaults() {
  const setting = await prisma.setting.findUnique({ where: { key: 'task_assignment_defaults' } })
  if (!setting?.value) return TASK_ASSIGNMENT_DEFAULTS
  try {
    return { ...TASK_ASSIGNMENT_DEFAULTS, ...JSON.parse(setting.value) }
  } catch {
    return TASK_ASSIGNMENT_DEFAULTS
  }
}

async function createTasksForWatch(watchId, taskDefaults, membersByDept) {
  const existing = await prisma.watchTask.count({ where: { watch_id: watchId } })
  if (existing > 0) return

  const taskData = WATCH_TASKS.map(t => ({
    ...t,
    watch_id: watchId,
    assigned_to: resolveAssignee(t.task_type, t.department, taskDefaults, membersByDept),
  }))
  await prisma.watchTask.createMany({ data: taskData })
}

async function seedMemberLogins() {
  const members = await prisma.teamMember.findMany({ orderBy: { id: 'asc' } })
  let masterExists = false
  const masterPassword = memberPassword('Master')
  const masterHash = hashPassword('Master', masterPassword)

  for (const member of members) {
    const isMaster = member.role === 'MASTER' || ['jhonny', 'johnny'].includes(member.name.toLowerCase())
    if (isMaster) {
      masterExists = true
      await prisma.teamMember.update({
        where: { id: member.id },
        data: {
          name: 'Master',
          login_username: 'Master',
          password_hash: masterHash,
          role: 'MASTER',
        },
      })
      continue
    }
    const loginUsername = (member.login_username || member.name).trim()
    await prisma.teamMember.update({
      where: { id: member.id },
      data: {
        login_username: loginUsername,
        password_hash: hashPassword(loginUsername, memberPassword(member.name)),
        role: 'MEMBER',
      },
    })
  }

  if (!masterExists) {
    await prisma.teamMember.create({
      data: {
        name: 'Master',
        whatsapp_number: '0000000000',
        department: 'LOGISTICS',
        login_username: 'Master',
        password_hash: masterHash,
        role: 'MASTER',
      },
    })
  }
}

async function restoreWatches() {
  const existingCount = await prisma.watch.count()
  if (existingCount > 0) return { imported: 0, skipped: true }

  const rows = loadActiveInventory()
  const members = await prisma.teamMember.findMany()
  const membersByDept = {}
  for (const m of members) membersByDept[m.department] = m.name
  const taskDefaults = await getTaskDefaults()

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
        payment_status: 'NOT_PAID',
        location_status: 'INCOMING',
        location_to: row.category,
        fob_url: row.fob_url,
      },
    })
    await createTasksForWatch(watch.id, taskDefaults, membersByDept)
    imported++
  }
  return { imported, skipped: false }
}

async function main() {
  const memberCount = await prisma.teamMember.count()
  const watchCount = await prisma.watch.count()
  console.log(`[restore-qc-data] members=${memberCount} watches=${watchCount}`)

  const team = await restoreTeamMembers()
  console.log('[restore-qc-data] team:', team)

  const settingsUpdated = await restoreSettings()
  console.log('[restore-qc-data] settings updated:', settingsUpdated)

  const watches = await restoreWatches()
  console.log('[restore-qc-data] watches:', watches)

  await seedMemberLogins()
  console.log('[restore-qc-data] member logins seeded')

  const finalMembers = await prisma.teamMember.count()
  const finalWatches = await prisma.watch.count()
  const finalTasks = await prisma.watchTask.count()
  console.log(`[restore-qc-data] final: members=${finalMembers} watches=${finalWatches} watchTasks=${finalTasks}`)
}

main()
  .catch(err => {
    console.error('[restore-qc-data] failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
