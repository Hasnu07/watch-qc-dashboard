// Optional SLA nudge — runs hourly; pings assignees on sell tasks open >24h
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWhatsAppMessage, toChatId } from '@/lib/greenapi'

export const runtime = 'nodejs'
export const maxDuration = 60

const SLA_HOURS = 24

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [instanceSetting, tokenSetting, urlSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'greenapi_instance_id' } }),
      prisma.setting.findUnique({ where: { key: 'greenapi_api_token' } }),
      prisma.setting.findUnique({ where: { key: 'greenapi_api_url' } }),
    ])

    if (!instanceSetting?.value || !tokenSetting?.value) {
      return NextResponse.json({ ok: false, reason: 'GreenAPI not configured' })
    }

    const cutoff = new Date(Date.now() - SLA_HOURS * 60 * 60 * 1000)

    const overdueTasks = await prisma.watchTask.findMany({
      where: {
        phase: 'SELL',
        is_completed: false,
        watch: { watch_type: 'SELL', created_at: { lte: cutoff } },
      },
      include: {
        watch: { select: { id: true, stock_no: true, brand: true, model: true, name: true } },
      },
    })

    const members = await prisma.teamMember.findMany()
    const memberMap = new Map(members.map(m => [m.name.toLowerCase(), m.whatsapp_number]))

    const byPerson = new Map<string, string[]>()
    for (const task of overdueTasks) {
      if (!task.assigned_to) continue
      const w = task.watch
      const label = `#${w.stock_no || w.id} ${[w.brand, w.model].filter(Boolean).join(' ') || w.name}`
      if (!byPerson.has(task.assigned_to)) byPerson.set(task.assigned_to, [])
      const list = byPerson.get(task.assigned_to)!
      if (!list.includes(label)) list.push(label)
    }

    const results = await Promise.allSettled(
      Array.from(byPerson.entries()).map(([name, watches]) => {
        const number = memberMap.get(name.toLowerCase())
        if (!number) return Promise.resolve(false)
        const lines = watches.map(w => `• ${w}`).join('\n')
        const msg = `⏰ Sell tasks overdue (>${SLA_HOURS}h):\n${lines}\n\nPlease complete on the dashboard.`
        return sendWhatsAppMessage(
          instanceSetting.value,
          tokenSetting.value,
          toChatId(number),
          msg,
          urlSetting?.value || 'https://api.green-api.com',
        )
      }),
    )

    const sent = results.filter(r => r.status === 'fulfilled' && r.value).length
    return NextResponse.json({ ok: true, overdue_tasks: overdueTasks.length, nudges_sent: sent })
  } catch (err) {
    console.error('[Cron] SLA nudge error:', err)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
