import { prisma } from './prisma'
import { sendWhatsAppMessage, toChatId } from './greenapi'
import { emitWatchTaskEvent } from './events'

type Dept = 'ACCOUNTING' | 'SALES' | 'LOGISTICS'

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
  SALES_UPDATE_B2B: 'Update B2B Prices',
  LOGISTICS_SET_LOCATION: 'Set Location',
  LOGISTICS_UPDATE_COST: 'Update Logistics Cost',
  LOGISTICS_ACCESSORIES_BOX: 'Box',
  LOGISTICS_ACCESSORIES_PAPERS: 'Papers',
  LOGISTICS_ACCESSORIES_EXTRA_LINKS: 'Extra Links',
  LOGISTICS_ACCESSORIES_WARRANTY_CARD: 'Warranty Card',
  LOGISTICS_ACCESSORIES_HANG_TAG: 'Hang Tag',
}

async function getGreenAPISettings() {
  const [inst, tok] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'greenapi_instance_id' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_token' } }),
  ])
  if (!inst?.value || !tok?.value) return null
  return { instanceId: inst.value, token: tok.value }
}

export async function notifyDept(dept: Dept, message: string) {
  const settings = await getGreenAPISettings()
  if (!settings) return
  const members = await prisma.teamMember.findMany({ where: { department: dept } })
  await Promise.allSettled(
    members.map(m =>
      sendWhatsAppMessage(settings.instanceId, settings.token, toChatId(m.whatsapp_number), message)
    )
  )
}

export async function createWatchTasks(watchId: number, watchName: string) {
  // Guard: skip if tasks already exist (prevents duplicates on any retry)
  const existing = await prisma.watchTask.count({ where: { watch_id: watchId } })
  if (existing > 0) return

  await prisma.watchTask.createMany({
    data: WATCH_TASKS.map(t => ({ ...t, watch_id: watchId })),
  })

  // Fire-and-forget WhatsApp notifications
  notifyDept('ACCOUNTING', `New watch added: ${watchName}. Your task: Mark the payment status.`).catch(console.error)
  notifyDept('SALES', `New watch added: ${watchName}. Your tasks: Set price, Upload to Drive, Upload to Stock Group, Update B2B prices.`).catch(console.error)
  notifyDept('LOGISTICS', `New watch added: ${watchName}. Your tasks: Update logistics cost and accessories. Location update will unlock after payment confirmation.`).catch(console.error)
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
      notifyDept('LOGISTICS', `${watchLabel} is ready for location update. Payment has been confirmed.`).catch(console.error)
    }
  }
}

export async function sendTaskCompletedNotification(dept: Dept, watchName: string, taskLabel: string) {
  notifyDept(dept, `${watchName} — ${taskLabel} has been marked complete.`).catch(console.error)
}

export async function sendPendingTaskReminders() {
  const settings = await getGreenAPISettings()
  if (!settings) return

  const depts: Dept[] = ['ACCOUNTING', 'SALES', 'LOGISTICS']
  for (const dept of depts) {
    const pendingTasks = await prisma.watchTask.findMany({
      where: {
        department: dept,
        is_completed: false,
        is_locked: false,
        watch: { is_sold: false },
      },
      include: { watch: { select: { id: true, name: true, brand: true, model: true } } },
      orderBy: { watch_id: 'asc' },
    })

    if (pendingTasks.length === 0) continue

    const byWatch = new Map<number, { watchName: string; labels: string[] }>()
    for (const task of pendingTasks) {
      const wName = [task.watch.brand, task.watch.model].filter(Boolean).join(' ') || task.watch.name
      if (!byWatch.has(task.watch_id)) byWatch.set(task.watch_id, { watchName: wName, labels: [] })
      byWatch.get(task.watch_id)!.labels.push(TASK_LABELS[task.task_type] ?? task.task_type)
    }

    const lines = Array.from(byWatch.values())
      .map(({ watchName, labels }) => `• ${watchName}: ${labels.join(', ')}`)
      .join('\n')

    const message = `Reminder — Pending tasks:\n${lines}`
    const members = await prisma.teamMember.findMany({ where: { department: dept } })
    await Promise.allSettled(
      members.map(m =>
        sendWhatsAppMessage(settings.instanceId, settings.token, toChatId(m.whatsapp_number), message)
      )
    )
  }
}
