import cron from 'node-cron'
import { sendPendingTaskReminders } from './watch-tasks'

let cronStarted = false

export function startCronJobs() {
  if (cronStarted) return
  cronStarted = true

  // Send task reminders every 3 hours
  cron.schedule('0 */3 * * *', async () => {
    console.log('[Cron] Sending 3-hour task reminders...')
    try {
      await sendPendingTaskReminders()
      console.log('[Cron] Reminders sent.')
    } catch (err) {
      console.error('[Cron] Reminder error:', err)
    }
  })

  console.log('[Cron] 3-hour task reminder cron started.')
}
