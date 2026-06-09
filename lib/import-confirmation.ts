import { prisma } from './prisma'
import { sendWhatsAppMessage } from './greenapi'
import { getTaskLabel } from './task-labels'

async function getGreenAPISettings() {
  const [inst, tok, url] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'greenapi_instance_id' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_token' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_url' } }),
  ])
  if (!inst?.value || !tok?.value) return null
  return { instanceId: inst.value, token: tok.value, apiUrl: url?.value || 'https://api.green-api.com' }
}

export async function sendImportGroupConfirmation(
  chatId: string,
  watch: { id: number; name: string; brand: string | null; model: string | null; stock_no: string | null },
  watchType: 'BUY' | 'SELL',
) {
  const settings = await getGreenAPISettings()
  if (!settings || !chatId) return false

  const fullWatch = await prisma.watch.findUnique({
    where: { id: watch.id },
    select: {
      id: true,
      stock_no: true,
      brand: true,
      model: true,
      ref_no: true,
      serial_no: true,
      watch_date: true,
      currency: true,
      purchase_price: true,
      website_price: true,
      bought_from: true,
      sold_to: true,
    },
  })
  if (!fullWatch) return false

  const tasks = await prisma.watchTask.findMany({
    where: { watch_id: watch.id, phase: watchType === 'SELL' ? 'SELL' : { not: 'SELL' } },
    select: { assigned_to: true, task_type: true, phase: true },
    orderBy: { id: 'asc' },
  })

  const byAssignee = new Map<string, string[]>()
  for (const task of tasks) {
    const who = task.assigned_to?.trim() || 'Unassigned'
    if (!byAssignee.has(who)) byAssignee.set(who, [])
    byAssignee.get(who)!.push(getTaskLabel(task.task_type, task.phase === 'SELL' ? 'SELL' : 'BUY'))
  }

  const assignmentLines = Array.from(byAssignee.entries()).map(([assignee, labels]) => {
    const unique = Array.from(new Set(labels))
    return `• ${assignee}: ${unique.join(', ')}`
  })

  const label = [fullWatch.brand, fullWatch.model].filter(Boolean).join(' ') || watch.name
  const stockLabel = fullWatch.stock_no ? `#${fullWatch.stock_no}` : `#${fullWatch.id}`
  const refLine = fullWatch.ref_no ? `Ref: ${fullWatch.ref_no}` : null
  const serialLine = fullWatch.serial_no ? `Serial: ${fullWatch.serial_no}` : null
  const dateLine = fullWatch.watch_date ? `Watch Date: ${fullWatch.watch_date}` : null
  const sideLine = watchType === 'SELL'
    ? (fullWatch.sold_to ? `Sold To: ${fullWatch.sold_to}` : null)
    : (fullWatch.bought_from ? `Bought From: ${fullWatch.bought_from}` : null)
  const priceRaw = watchType === 'SELL' ? fullWatch.website_price : fullWatch.purchase_price
  const priceNum = Number(priceRaw || 0)
  const priceLine = priceNum > 0 ? `Price: ${priceNum.toLocaleString()} ${fullWatch.currency || 'USD'}` : null

  const msg = [
    `✅ ${watchType} imported from group`,
    `${stockLabel} · ${label}`,
    [refLine, serialLine, dateLine, sideLine, priceLine].filter(Boolean).join(' | '),
    '',
    'Assigned tasks:',
    ...(assignmentLines.length > 0 ? assignmentLines : ['• Team: (no assignments found yet)']),
  ].filter(Boolean).join('\n')

  return sendWhatsAppMessage(settings.instanceId, settings.token, chatId, msg, settings.apiUrl)
}
