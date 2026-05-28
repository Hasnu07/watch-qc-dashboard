import cron from 'node-cron'
import { prisma } from './prisma'
import { sendPendingTaskReminders } from './watch-tasks'

let cronStarted = false

function minutesToCron(minutes: number): string {
  const m = Math.max(15, Math.min(1440, minutes))
  if (m >= 60) {
    const hours = Math.round(m / 60)
    return `0 */${hours} * * *`
  }
  return `*/${m} * * * *`
}

async function getReminderIntervalMinutes(): Promise<number> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'reminder_interval_minutes' } })
    const n = parseInt(setting?.value || '180', 10)
    return Number.isFinite(n) && n > 0 ? n : 180
  } catch {
    return 180
  }
}

export async function startCronJobs() {
  if (cronStarted) return
  cronStarted = true

  const minutes = await getReminderIntervalMinutes()
  const expr = minutesToCron(minutes)

  cron.schedule(expr, async () => {
    console.log(`[Cron] Sending task reminders (every ${minutes}m)...`)
    try {
      await sendPendingTaskReminders()
      console.log('[Cron] Reminders sent.')
    } catch (err) {
      console.error('[Cron] Reminder error:', err)
    }
  })

  console.log(`[Cron] Task reminder cron started: ${expr} (${minutes} min from settings)`)
}
