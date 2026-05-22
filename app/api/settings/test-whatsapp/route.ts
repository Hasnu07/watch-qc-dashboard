import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWhatsAppMessage, toChatId } from '@/lib/greenapi'

export async function POST() {
  try {
    const [instRow, tokRow, urlRow] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'greenapi_instance_id' } }),
      prisma.setting.findUnique({ where: { key: 'greenapi_api_token' } }),
      prisma.setting.findUnique({ where: { key: 'greenapi_api_url' } }),
    ])

    if (!instRow?.value || !tokRow?.value) {
      return NextResponse.json({ error: 'GreenAPI credentials not configured' }, { status: 400 })
    }

    const instanceId = instRow.value
    const apiToken = tokRow.value
    const apiUrl = urlRow?.value || 'https://api.green-api.com'

    const members = await prisma.teamMember.findMany({ orderBy: { id: 'asc' } })

    if (members.length === 0) {
      return NextResponse.json({ error: 'No team members found to send test to' }, { status: 400 })
    }

    const message = `✅ Test message from Watch QC Dashboard.\n\nWhatsApp integration is working correctly!\nInstance: ${instanceId}`

    const results = await Promise.allSettled(
      members.map(m =>
        sendWhatsAppMessage(instanceId, apiToken, toChatId(m.whatsapp_number), message, apiUrl)
          .then(ok => ({ name: m.name, number: m.whatsapp_number, ok }))
      )
    )

    const report = results.map(r =>
      r.status === 'fulfilled'
        ? r.value
        : { name: '?', number: '?', ok: false }
    )

    const successCount = report.filter(r => r.ok).length
    return NextResponse.json({ successCount, total: members.length, report })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
}
