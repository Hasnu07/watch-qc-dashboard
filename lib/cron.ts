import cron from 'node-cron'
import { prisma } from './prisma'
import { sendWhatsAppMessage, toChatId } from './greenapi'

// Returns current time as "HH:MM" in PKT (UTC+5)
function getPKTTime(): { hours: number; minutes: number } {
  const now = new Date()
  const pktOffset = 5 * 60 * 60 * 1000
  const pkt = new Date(now.getTime() + pktOffset)
  return { hours: pkt.getUTCHours(), minutes: pkt.getUTCMinutes() }
}

async function sendMorningMessages() {
  try {
    const [instanceSetting, tokenSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'greenapi_instance_id' } }),
      prisma.setting.findUnique({ where: { key: 'greenapi_api_token' } }),
    ])

    if (!instanceSetting?.value || !tokenSetting?.value) {
      console.log('[Cron] GreenAPI credentials not configured, skipping.')
      return
    }

    const members = await prisma.teamMember.findMany()
    if (members.length === 0) return

    console.log(`[Cron] Sending morning messages to ${members.length} members...`)

    await Promise.allSettled(
      members.map((member) =>
        sendWhatsAppMessage(
          instanceSetting.value,
          tokenSetting.value,
          toChatId(member.whatsapp_number),
          'Good morning! Please list your tasks for today.'
        )
      )
    )

    console.log('[Cron] Morning messages sent.')
  } catch (err) {
    console.error('[Cron] Error sending morning messages:', err)
  }
}

let cronStarted = false

export function startCronJobs() {
  if (cronStarted) return
  cronStarted = true

  // Run every minute, check if it's the configured time in PKT
  cron.schedule('* * * * *', async () => {
    try {
      const timeSetting = await prisma.setting.findUnique({
        where: { key: 'auto_message_time' },
      })
      const timeStr = timeSetting?.value ?? '08:00'
      const [targetHours, targetMinutes] = timeStr.split(':').map(Number)
      const { hours, minutes } = getPKTTime()

      if (hours === targetHours && minutes === targetMinutes) {
        await sendMorningMessages()
      }
    } catch (err) {
      console.error('[Cron] Tick error:', err)
    }
  })

  console.log('[Cron] Scheduled morning message cron started (checks every minute, PKT timezone).')
}
