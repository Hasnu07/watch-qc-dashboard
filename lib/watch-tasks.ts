import { prisma } from './prisma'
import { getVisibleWatches } from './watch-visibility'
import { sendWhatsAppMessage, toChatId } from './greenapi'
import { emitWatchTaskEvent } from './events'

const APP_LINK = 'https://qc-dashboard-q907.onrender.com'

/** Built-in assignee when no settings override and no dept fallback desired */
const BUILTIN_TASK_ASSIGNEES: Record<string, string> = {
  SALES_UPLOAD_STOCK_GROUP: 'Hasnain Graphics',
}

const WATCH_TASKS = [
  { department: 'ACCOUNTING' as const, task_type: 'ACCOUNTING_MARK_PAYMENT' as const, is_locked: false },
  { department: 'ACCOUNTING' as const, task_type: 'ACCOUNTING_ADD_STOCK_FOB' as const, is_locked: false },
  { department: 'SALES' as const, task_type: 'SALES_SET_PRICE' as const, is_locked: false },
  { department: 'SALES' as const, task_type: 'SALES_UPLOAD_DRIVE' as const, is_locked: false },
  { department: 'SALES' as const, task_type: 'SALES_UPLOAD_STOCK_GROUP' as const, is_locked: false },
  { department: 'SALES' as const, task_type: 'SALES_UPDATE_B2B' as const, is_locked: false },
  { department: 'SALES' as const, task_type: 'SALES_GET_B2C_PRICES' as const, is_locked: false },
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
  ACCOUNTING_ADD_STOCK_FOB: 'Add Stock No in FOB',
  SALES_SET_PRICE: 'Set Price',
  SALES_UPLOAD_DRIVE: 'Upload to Drive',
  SALES_UPLOAD_STOCK_GROUP: 'Upload Photos To Whatsapp Stock Photos',
  SALES_UPDATE_B2B: 'Research B2B Price',
  SALES_GET_B2C_PRICES: 'Get B2C Prices from Josh',
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

/** Send WhatsApp only to the named assignee — never broadcast to a whole department. */
export async function notifyAssignee(assigneeName: string | null | undefined, message: string) {
  const name = assigneeName?.trim()
  if (!name) return
  const settings = await getGreenAPISettings()
  if (!settings) return
  const member = await prisma.teamMember.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  })
  if (!member?.whatsapp_number) return
  await sendWhatsAppMessage(
    settings.instanceId,
    settings.token,
    toChatId(member.whatsapp_number),
    message,
    settings.apiUrl,
  )
}

async function getMembersByDept() {
  const members = await prisma.teamMember.findMany()
  // Deterministic dept fallback so extra members (e.g. Kash) don't become the
  // implicit assignee for all unconfigured task types.
  const preferredByDept: Record<string, string> = {
    LOGISTICS: 'Haris',
    ACCOUNTING: 'Hassan',
    SALES: 'Aleena',
  }
  const map: Record<string, string> = {}
  for (const [dept, preferred] of Object.entries(preferredByDept)) {
    const exact = members.find(m => m.department === dept && m.name.toLowerCase() === preferred.toLowerCase())
    if (exact) {
      map[dept] = exact.name
      continue
    }
    const fallback = members.find(m => m.department === dept)
    if (fallback) map[dept] = fallback.name
  }
  return map
}

async function getTaskDefaults(): Promise<Record<string, string>> {
  const setting = await prisma.setting.findUnique({ where: { key: 'task_assignment_defaults' } })
  let defaults: Record<string, string> = {}
  if (setting?.value) {
    try { defaults = JSON.parse(setting.value) } catch { /* ignore */ }
  }
  const stockAssignee = defaults.SALES_UPLOAD_STOCK_GROUP
  if (!stockAssignee || stockAssignee === 'Aleena') {
    defaults.SALES_UPLOAD_STOCK_GROUP = BUILTIN_TASK_ASSIGNEES.SALES_UPLOAD_STOCK_GROUP
  }
  return defaults
}

/** Update legacy Aleena assignments for WhatsApp stock photo uploads */
export async function ensureStockGroupAssigneeDefault() {
  await prisma.watchTask.updateMany({
    where: {
      task_type: 'SALES_UPLOAD_STOCK_GROUP',
      is_completed: false,
      OR: [{ assigned_to: 'Aleena' }, { assigned_to: null }],
    },
    data: { assigned_to: BUILTIN_TASK_ASSIGNEES.SALES_UPLOAD_STOCK_GROUP },
  })
}

function resolveAssignee(taskType: string, dept: string, taskDefaults: Record<string, string>, membersByDept: Record<string, string>): string | null {
  // Per-task default wins; accessories share one key; built-in; fall back to dept member
  if (taskDefaults[taskType]) return taskDefaults[taskType]
  if (taskType.startsWith('LOGISTICS_ACCESSORIES') && taskDefaults['LOGISTICS_ACCESSORIES']) return taskDefaults['LOGISTICS_ACCESSORIES']
  if (BUILTIN_TASK_ASSIGNEES[taskType]) return BUILTIN_TASK_ASSIGNEES[taskType]
  return membersByDept[dept] ?? null
}

async function notifyAssignedPersons(
  watchName: string,
  tasks: Array<{ task_type: string; assigned_to: string | null }>,
) {
  const settings = await getGreenAPISettings()
  if (!settings) return

  const allMembers = await prisma.teamMember.findMany()
  const memberMap = new Map(allMembers.map(m => [m.name.toLowerCase(), m.whatsapp_number]))

  const assignees = new Set<string>()
  for (const t of tasks) {
    if (t.assigned_to) assignees.add(t.assigned_to)
  }

  await Promise.allSettled(
    Array.from(assignees).map((name) => {
      const number = memberMap.get(name.toLowerCase())
      if (!number) return Promise.resolve()
      const msg = `Your tasks for *${watchName}* (Buy) have been updated\n\n🔗 ${APP_LINK}`
      return sendWhatsAppMessage(settings.instanceId, settings.token, toChatId(number), msg, settings.apiUrl)
    })
  )
}

export async function assignWatchTasks(watchId: number, watchName: string, silent = false) {
  await ensureStockGroupAssigneeDefault()
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
    notifyAssignedPersons(watchName, updatedTasks).catch(console.error)
  }
}

export async function createWatchTasks(watchId: number, watchName: string, silent = false) {
  const existing = await prisma.watchTask.count({ where: { watch_id: watchId } })
  if (existing > 0) return

  await ensureStockGroupAssigneeDefault()
  const [membersByDept, taskDefaults] = await Promise.all([getMembersByDept(), getTaskDefaults()])

  const taskData = WATCH_TASKS.map(t => ({
    ...t,
    watch_id: watchId,
    assigned_to: resolveAssignee(t.task_type, t.department, taskDefaults, membersByDept),
  }))

  await prisma.watchTask.createMany({ data: taskData })

  if (!silent) {
    notifyAssignedPersons(watchName, taskData).catch(console.error)
  }
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
      notifyAssignee(
        task.assigned_to,
        `${watchLabel} is ready for location update. Payment has been confirmed.\n\n🔗 ${APP_LINK}`,
      ).catch(console.error)
    }
  }
}

export async function sendAllTasksCompletedNotification(watchId: number, watchName: string) {
  const settings = await getGreenAPISettings()
  if (!settings) return

  const allMembers = await prisma.teamMember.findMany()
  const memberMap = new Map(allMembers.map(m => [m.name.toLowerCase(), m.whatsapp_number]))

  const tasks = await prisma.watchTask.findMany({
    where: { watch_id: watchId, assigned_to: { not: null } },
    select: { assigned_to: true },
  })

  const assignees = [...new Set(tasks.map(t => t.assigned_to!))]

  await Promise.allSettled(
    assignees.map((name) => {
      const number = memberMap.get(name.toLowerCase())
      if (!number) return Promise.resolve()
      const msg = `Your tasks for *${watchName}* have been completed, good work`
      return sendWhatsAppMessage(settings.instanceId, settings.token, toChatId(number), msg, settings.apiUrl)
    })
  )
}

export async function sendPendingTaskReminders() {
  const settings = await getGreenAPISettings()
  if (!settings) return

  // Fetch all pending, unlocked watch tasks that have an assignee
  const visible = await getVisibleWatches()
  const visibleIds = new Set(visible.map(w => w.id))

  const pendingTasks = await prisma.watchTask.findMany({
    where: {
      is_completed: false,
      is_locked: false,
      assigned_to: { not: null },
      watch_id: { in: Array.from(visibleIds) },
    },
    include: { watch: { select: { id: true, name: true, brand: true, model: true } } },
    orderBy: { watch_id: 'asc' },
  })

  if (pendingTasks.length === 0) return

  // Group by assigned_to name
  const byPerson = new Map<string, Map<number, { watchName: string; taskTypes: string[] }>>()
  for (const task of pendingTasks) {
    const assignee = task.assigned_to!
    const wName = [task.watch.brand, task.watch.model].filter(Boolean).join(' ') || task.watch.name
    if (!byPerson.has(assignee)) byPerson.set(assignee, new Map())
    const watches = byPerson.get(assignee)!
    if (!watches.has(task.watch_id)) watches.set(task.watch_id, { watchName: wName, taskTypes: [] })
    watches.get(task.watch_id)!.taskTypes.push(task.task_type)
  }

  // Look up WhatsApp numbers for all assignees
  const allMembers = await prisma.teamMember.findMany()
  const memberMap = new Map(allMembers.map(m => [m.name.toLowerCase(), m.whatsapp_number]))

  await Promise.allSettled(
    Array.from(byPerson.entries()).map(([name, watches]) => {
      const number = memberMap.get(name.toLowerCase())
      if (!number) return Promise.resolve()
      const lines = Array.from(watches.values())
        .map(({ watchName, taskTypes }) => {
          const labels = labelsForTaskList(taskTypes, tt => TASK_LABELS[tt] ?? tt)
          return `• ${watchName}: ${labels.join(', ')}`
        })
        .join('\n')
      const message = `⏰ Reminder — Your pending tasks:\n${lines}\n\n🔗 ${APP_LINK}`
      return sendWhatsAppMessage(settings.instanceId, settings.token, toChatId(number), message, settings.apiUrl)
    })
  )
}
