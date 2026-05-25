import { prisma } from './prisma'
import { sendWhatsAppMessage, toChatId } from './greenapi'
import { emitWatchTaskEvent } from './events'

type Dept = 'ACCOUNTING' | 'SALES' | 'LOGISTICS'

const APP_LINK = 'https://qc-dashboard-q907.onrender.com'

const WATCH_TASKS = [
  { department: 'ACCOUNTING' as const, task_type: 'ACCOUNTING_MARK_PAYMENT' as const, is_locked: false },
  { department: 'SALES' as const, task_type: 'SALES_SET_PRICE' as const, is_locked: false },
  { department: 'SALES' as const, task_type: 'SALES_UPLOAD_DRIVE' as const, is_locked: false },
  { department: 'SALES' as const, task_type: 'SALES_UPLOAD_STOCK_GROUP' as const, is_locked: false },
  { department: 'SALES' as const, task_type: 'SALES_UPDATE_B2B' as const, is_locked: false },
  { department: 'LOGISTICS' as const, task_type: 'LOGISTICS_SET_LOCATION' as const, is_locked: true },
  { department: 'LOGISTICS' as const, task_type: 'LOGISTICS_UPDATE_COST' as const, is_locked: false },
  { department: 'LOGISTICS' as const, task_type: 'LOGISTICS_ACCESSORIES_BOX' as const, is_locked: false },
  { department: 'LOGISTICS' as const, task_type: 'LOGISTICS_ACCESSORIES_PAPERS' as const, is_locked: false },
  { department: 'LOGISTICS' as const, task_type: 'LOGISTICS_ACCESSORIES_EXTRA_LINKS' as const, is_locked: false },
  { department: 'LOGISTICS' as const, task_type: 'LOGISTICS_ACCESSORIES_WARRANTY_CARD' as const, is_locked: false },
  { department: 'LOGISTICS' as const, task_type: 'LOGISTICS_ACCESSORIES_HANG_TAG' as const, is_locked: false },
]

export const TASK_LABELS: Record<string, string> = {
  ACCOUNTING_MARK_PAYMENT: 'Mark Payment Status',
  SALES_SET_PRICE: 'Set Price',
  SALES_UPLOAD_DRIVE: 'Upload to Drive',
  SALES_UPLOAD_STOCK_GROUP: 'Upload to Stock Group',
  SALES_UPDATE_B2B: 'Research B2B Price',
  LOGISTICS_SET_LOCATION: 'Set Location',
  LOGISTICS_UPDATE_COST: 'Update Logistics Cost',
  LOGISTICS_ACCESSORIES_BOX: 'Box',
  LOGISTICS_ACCESSORIES_PAPERS: 'Papers',
  LOGISTICS_ACCESSORIES_EXTRA_LINKS: 'Extra Links',
  LOGISTICS_ACCESSORIES_WARRANTY_CARD: 'Warranty Card',
  LOGISTICS_ACCESSORIES_HANG_TAG: 'Hang Tag',
}

async function getGreenAPISettings() {
  const [inst, tok, url] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'greenapi_instance_id' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_token' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_url' } }),
  ])
  if (!inst?.value || !tok?.value) return null
  return {
    instanceId: inst.value,
    token: tok.value,
    apiUrl: url?.value || 'https://api.green-api.com',
  }
}

export async function notifyDept(dept: Dept, message: string) {
  const settings = await getGreenAPISettings()
  if (!settings) return
  const members = await prisma.teamMember.findMany({ where: { department: dept } })
  await Promise.allSettled(
    members.map(m =>
      sendWhatsAppMessage(settings.instanceId, settings.token, toChatId(m.whatsapp_number), message, settings.apiUrl)
    )
  )
}

async function getMembersByDept() {
  const members = await prisma.teamMember.findMany()
  const map: Record<string, string> = {}
  for (const m of members) map[m.department] = m.name
  return map
}

async function getTaskDefaults(): Promise<Record<string, string>> {
  const setting = await prisma.setting.findUnique({ where: { key: 'task_assignment_defaults' } })
  if (!setting?.value) return {}
  try { return JSON.parse(setting.value) } catch { return {} }
}

function resolveAssignee(taskType: string, dept: string, taskDefaults: Record<string, string>, membersByDept: Record<string, string>): string | null {
  // Per-task default wins; accessories share one key; fall back to dept member
  if (taskDefaults[taskType]) return taskDefaults[taskType]
  if (taskType.startsWith('LOGISTICS_ACCESSORIES') && taskDefaults['LOGISTICS_ACCESSORIES']) return taskDefaults['LOGISTICS_ACCESSORIES']
  return membersByDept[dept] ?? null
}

async function notifyAssignedPersons(
  watchName: string,
  tasks: Array<{ task_type: string; assigned_to: string | null }>,
  intro = 'New watch added'
) {
  const settings = await getGreenAPISettings()
  if (!settings) return

  const allMembers = await prisma.teamMember.findMany()
  const memberMap = new Map(allMembers.map(m => [m.name.toLowerCase(), m.whatsapp_number]))

  // Group tasks by assignee name
  const byPerson = new Map<string, string[]>()
  for (const t of tasks) {
    if (!t.assigned_to) continue
    if (!byPerson.has(t.assigned_to)) byPerson.set(t.assigned_to, [])
    byPerson.get(t.assigned_to)!.push(TASK_LABELS[t.task_type] ?? t.task_type)
  }

  await Promise.allSettled(
    Array.from(byPerson.entries()).map(([name, labels]) => {
      const number = memberMap.get(name.toLowerCase())
      if (!number) return Promise.resolve()
      const taskLines = labels.map(l => `• ${l}`).join('\n')
      const msg = `📋 ${intro}: *${watchName}*\n\nYour assigned tasks:\n${taskLines}\n\n🔗 ${APP_LINK}`
      return sendWhatsAppMessage(settings.instanceId, settings.token, toChatId(number), msg, settings.apiUrl)
    })
  )
}

export async function assignWatchTasks(watchId: number, watchName: string, silent = false) {
  const [membersByDept, taskDefaults] = await Promise.all([getMembersByDept(), getTaskDefaults()])

  const tasks = await prisma.watchTask.findMany({ where: { watch_id: watchId } })
  const updatedTasks = await Promise.all(
    tasks.map(async t => {
      const assignee = resolveAssignee(t.task_type, t.department as string, taskDefaults, membersByDept)
      await prisma.watchTask.update({ where: { id: t.id }, data: { assigned_to: assignee } })
      return { task_type: t.task_type, assigned_to: assignee }
    })
  )

  if (!silent) {
    notifyAssignedPersons(watchName, updatedTasks, 'Tasks assigned for').catch(console.error)
  }
}

export async function createWatchTasks(watchId: number, watchName: string) {
  const existing = await prisma.watchTask.count({ where: { watch_id: watchId } })
  if (existing > 0) return

  const [membersByDept, taskDefaults] = await Promise.all([getMembersByDept(), getTaskDefaults()])

  const taskData = WATCH_TASKS.map(t => ({
    ...t,
    watch_id: watchId,
    assigned_to: resolveAssignee(t.task_type, t.department, taskDefaults, membersByDept),
  }))

  await prisma.watchTask.createMany({ data: taskData })

  // Notify each person of their specific assigned tasks
  notifyAssignedPersons(watchName, taskData, 'New watch added').catch(console.error)
}

export async function checkAndUnlockLocation(watchId: number) {
  const watch = await prisma.watch.findUnique({
    where: { id: watchId },
    select: { payment_status: true, name: true, brand: true, model: true },
  })
  if (!watch) return

  if (watch.payment_status === 'PAID' || watch.payment_status === 'PARTIAL') {
    const task = await prisma.watchTask.findFirst({
      where: { watch_id: watchId, task_type: 'LOGISTICS_SET_LOCATION', is_locked: true },
    })
    if (task) {
      await prisma.watchTask.update({ where: { id: task.id }, data: { is_locked: false } })
      emitWatchTaskEvent({ type: 'task_unlocked', watch_task_id: task.id, watch_id: watchId })
      const watchLabel = [watch.brand, watch.model].filter(Boolean).join(' ') || watch.name
      notifyDept('LOGISTICS', `${watchLabel} is ready for location update. Payment has been confirmed.\n\n🔗 ${APP_LINK}`).catch(console.error)
    }
  }
}

export async function sendTaskCompletedNotification(dept: Dept, watchName: string, taskLabel: string) {
  notifyDept(dept, `${watchName} — ${taskLabel} has been marked complete.\n\n🔗 ${APP_LINK}`).catch(console.error)
}

export async function sendPendingTaskReminders() {
  const settings = await getGreenAPISettings()
  if (!settings) return

  // Fetch all pending, unlocked watch tasks that have an assignee
  const pendingTasks = await prisma.watchTask.findMany({
    where: {
      is_completed: false,
      is_locked: false,
      assigned_to: { not: null },
      watch: { is_sold: false },
    },
    include: { watch: { select: { id: true, name: true, brand: true, model: true } } },
    orderBy: { watch_id: 'asc' },
  })

  if (pendingTasks.length === 0) return

  // Group by assigned_to name
  const byPerson = new Map<string, Map<number, { watchName: string; labels: string[] }>>()
  for (const task of pendingTasks) {
    const assignee = task.assigned_to!
    const wName = [task.watch.brand, task.watch.model].filter(Boolean).join(' ') || task.watch.name
    if (!byPerson.has(assignee)) byPerson.set(assignee, new Map())
    const watches = byPerson.get(assignee)!
    if (!watches.has(task.watch_id)) watches.set(task.watch_id, { watchName: wName, labels: [] })
    watches.get(task.watch_id)!.labels.push(TASK_LABELS[task.task_type] ?? task.task_type)
  }

  // Look up WhatsApp numbers for all assignees
  const allMembers = await prisma.teamMember.findMany()
  const memberMap = new Map(allMembers.map(m => [m.name.toLowerCase(), m.whatsapp_number]))

  await Promise.allSettled(
    Array.from(byPerson.entries()).map(([name, watches]) => {
      const number = memberMap.get(name.toLowerCase())
      if (!number) return Promise.resolve()
      const lines = Array.from(watches.values())
        .map(({ watchName, labels }) => `• ${watchName}: ${labels.join(', ')}`)
        .join('\n')
      const message = `⏰ Reminder — Your pending tasks:\n${lines}\n\n🔗 ${APP_LINK}`
      return sendWhatsAppMessage(settings.instanceId, settings.token, toChatId(number), message, settings.apiUrl)
    })
  )
}
