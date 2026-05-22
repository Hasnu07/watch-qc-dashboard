// Vercel Cron Job — runs daily at 03:00 UTC (08:00 PKT)
// Triggered by vercel.json cron schedule
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWhatsAppMessage, toChatId } from '@/lib/greenapi'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Protect endpoint — Vercel sends Authorization header with CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [instanceSetting, tokenSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'greenapi_instance_id' } }),
      prisma.setting.findUnique({ where: { key: 'greenapi_api_token' } }),
    ])

    if (!instanceSetting?.value || !tokenSetting?.value) {
      return NextResponse.json({ ok: false, reason: 'GreenAPI not configured' })
    }

    const members = await prisma.teamMember.findMany()
    if (members.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const results = await Promise.allSettled(
      members.map(m =>
        sendWhatsAppMessage(
          instanceSetting.value,
          tokenSetting.value,
          toChatId(m.whatsapp_number),
          'Good morning! Please list your tasks for today.'
        )
      )
    )

    const sent = results.filter(r => r.status === 'fulfilled' && r.value).length
    console.log(`[Cron] Morning messages sent: ${sent}/${members.length}`)
    return NextResponse.json({ ok: true, sent, total: members.length })
  } catch (err) {
    console.error('[Cron] Error:', err)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
