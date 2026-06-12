import { prisma } from './prisma'
import { sendWhatsAppMessage, toChatId } from './greenapi'
import { DEFAULT_BUY_TEMPLATES, DEFAULT_SELL_TEMPLATES } from './sell-task-templates'

export { DEFAULT_BUY_TEMPLATES, DEFAULT_SELL_TEMPLATES, SELL_BLOCKING_TASK_LABELS } from './sell-task-templates'

const APP_LINK = 'https://qc-dashboard-q907.onrender.com'

// Ensures builtin templates exist. Only fills in default_assignee on creation
// or when the existing row has none — never overwrites a user-set assignee.
export async function ensureDefaultTemplates() {
  const allDefaults = [
    ...DEFAULT_BUY_TEMPLATES.map(t => ({ ...t, phase: 'BUY' })),
    ...DEFAULT_SELL_TEMPLATES.map(t => ({ ...t, phase: 'SELL' })),
  ]

  for (const tpl of allDefaults) {
    const existing = await prisma.taskTemplate.findFirst({
      where: { phase: tpl.phase, is_builtin: true, label: tpl.label },
    })
    if (existing) {
      // Keep structure in sync but never overwrite an assignee a user already set.
      const data: { department: string; order: number; default_assignee?: string | null } = {
        department: tpl.department,
        order: tpl.order,
      }
      if (existing.default_assignee == null && tpl.default_assignee) {
        data.default_assignee = tpl.default_assignee
      }
      await prisma.taskTemplate.update({ where: { id: existing.id }, data })
    } else {
      await prisma.taskTemplate.create({ data: tpl })
    }
  }
}

export async function createWatchSellTasks(watchId: number, watchName: string) {
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
      assigned_to: t.default_assignee ?? null,
    })),
  })

  notifySellTasksCreated(watchName, templates).catch(console.error)
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

async function notifySellTasksCreated(watchName: string, templates: Array<{ label: string; default_assignee: string | null; department: string }>) {
  const settings = await getGreenAPISettings()
  if (!settings) return

  const allMembers = await prisma.teamMember.findMany()
  const memberMap = new Map(allMembers.map(m => [m.name.toLowerCase(), m.whatsapp_number]))

  const assignees = new Set<string>()
  for (const t of templates) {
    if (t.default_assignee) assignees.add(t.default_assignee)
  }

  await Promise.allSettled(
    Array.from(assignees).map((name) => {
      const number = memberMap.get(name.toLowerCase())
      if (!number) return Promise.resolve()
      const msg = `Your tasks for *${watchName}* (Sell) have been updated\n\n🔗 ${APP_LINK}`
      return sendWhatsAppMessage(settings.instanceId, settings.token, toChatId(number), msg, settings.apiUrl)
    })
  )
}
