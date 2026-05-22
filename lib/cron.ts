import cron from 'node-cron'
import { sendPendingTaskReminders } from './watch-tasks'

let cronStarted = false

export function startCronJobs() {
  if (cronStarted) return
  cronStarted = true

  // Send task reminders every 20 minutes
  cron.schedule('*/20 * * * *', async () => {
    console.log('[Cron] Sending 20-min task reminders...')
    try {
      await sendPendingTaskReminders()
      console.log('[Cron] Reminders sent.')
    } catch (err) {
      console.error('[Cron] Reminder error:', err)
    }
  })

  console.log('[Cron] 20-minute task reminder cron started.')
}
