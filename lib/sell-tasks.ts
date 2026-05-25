import { prisma } from './prisma'
import { sendWhatsAppMessage, toChatId } from './greenapi'

const APP_LINK = 'https://qc-dashboard-q907.onrender.com'

export const DEFAULT_BUY_TEMPLATES = [
  { label: 'Mark Payment Status', department: 'ACCOUNTING', task_type_key: 'ACCOUNTING_MARK_PAYMENT', is_locked: false, is_builtin: true, order: 0 },
  { label: 'Set Price', department: 'SALES', task_type_key: 'SALES_SET_PRICE', is_locked: false, is_builtin: true, order: 1 },
  { label: 'Upload to Drive', department: 'SALES', task_type_key: 'SALES_UPLOAD_DRIVE', is_locked: false, is_builtin: true, order: 2 },
  { label: 'Upload Photos To Whatsapp Stock Photos', department: 'SALES', task_type_key: 'SALES_UPLOAD_STOCK_GROUP', is_locked: false, is_builtin: true, order: 3 },
  { label: 'Research B2B Price', department: 'SALES', task_type_key: 'SALES_UPDATE_B2B', is_locked: false, is_builtin: true, order: 4 },
  { label: 'Get B2C Prices from Josh', department: 'SALES', task_type_key: 'SALES_GET_B2C_PRICES', is_locked: false, is_builtin: true, order: 5 },
  { label: 'Set Location', department: 'LOGISTICS', task_type_key: 'LOGISTICS_SET_LOCATION', is_locked: true, is_builtin: true, order: 6 },
  { label: 'Update Logistics Cost', department: 'LOGISTICS', task_type_key: 'LOGISTICS_UPDATE_COST', is_locked: false, is_builtin: true, order: 7 },
  { label: 'Box', department: 'LOGISTICS', task_type_key: 'LOGISTICS_ACCESSORIES_BOX', is_locked: false, is_builtin: true, order: 8 },
  { label: 'Papers', department: 'LOGISTICS', task_type_key: 'LOGISTICS_ACCESSORIES_PAPERS', is_locked: false, is_builtin: true, order: 9 },
  { label: 'Extra Links', department: 'LOGISTICS', task_type_key: 'LOGISTICS_ACCESSORIES_EXTRA_LINKS', is_locked: false, is_builtin: true, order: 10 },
  { label: 'Warranty Card', department: 'LOGISTICS', task_type_key: 'LOGISTICS_ACCESSORIES_WARRANTY_CARD', is_locked: false, is_builtin: true, order: 11 },
  { label: 'Hang Tag', department: 'LOGISTICS', task_type_key: 'LOGISTICS_ACCESSORIES_HANG_TAG', is_locked: false, is_builtin: true, order: 12 },
]

export const DEFAULT_SELL_TEMPLATES = [
  { label: 'Logistics Handled', department: 'LOGISTICS', task_type_key: null, is_locked: false, is_builtin: true, order: 0 },
  { label: 'Delete from Drive & Stock List', department: 'SALES', task_type_key: null, is_locked: false, is_builtin: true, order: 1 },
  { label: 'Share Shipment Address to Haris', department: 'SALES', task_type_key: null, is_locked: false, is_builtin: true, order: 2 },
  { label: 'Share Payment Status and Amount to Accounts Team', department: 'SALES', task_type_key: null, is_locked: false, is_builtin: true, order: 3 },
  { label: 'Set Status on FOB', department: 'ACCOUNTING', task_type_key: null, is_locked: false, is_builtin: true, order: 4 },
  { label: 'Make Invoice to Client', department: 'ACCOUNTING', task_type_key: null, is_locked: false, is_builtin: true, order: 5 },
]

export async function ensureDefaultTemplates() {
  const count = await prisma.taskTemplate.count()
  if (count > 0) return

  await prisma.taskTemplate.createMany({
    data: [
      ...DEFAULT_BUY_TEMPLATES.map(t => ({ ...t, phase: 'BUY' })),
      ...DEFAULT_SELL_TEMPLATES.map(t => ({ ...t, phase: 'SELL' })),
    ],
  })
}

export async function createWatchSellTasks(watchId: number, watchName: string) {
  // Don't duplicate
  const existing = await prisma.watchTask.count({ where: { watch_id: watchId, phase: 'SELL' } })
  if (existing > 0) return

  await ensureDefaultTemplates()

  const templates = await prisma.taskTemplate.findMany({ where: { phase: 'SELL' }, orderBy: { order: 'asc' } })
  if (templates.length === 0) return

  await prisma.watchTask.createMany({
    data: templates.map(t => ({
      watch_id: watchId,
      department: t.department as 'ACCOUNTING' | 'SALES' | 'LOGISTICS',
      task_type: t.task_type_key ?? t.label,
      phase: 'SELL',
      is_locked: t.is_locked,
    })),
  })

  // Notify team
  notifySellTasksCreated(watchName).catch(console.error)
}

async function getGreenAPISettings() {
  const [inst, tok, url] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'greenapi_instance_id' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_token' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_url' } }),
  ])
  if (!inst?.value || !tok?.value) return null
  return { instanceId: inst.value, token: tok.value, apiUrl: url?.value || 'https://api.green-api.com' }
}

async function notifySellTasksCreated(watchName: string) {
  const settings = await getGreenAPISettings()
  if (!settings) return
  const members = await prisma.teamMember.findMany()
  const msg = `🏷️ Watch SOLD: *${watchName}*\n\nSell tasks have been created. Please complete your assigned tasks.\n\n🔗 ${APP_LINK}`
  await Promise.allSettled(
    members.map(m =>
      sendWhatsAppMessage(settings.instanceId, settings.token, toChatId(m.whatsapp_number), msg, settings.apiUrl)
    )
  )
}
