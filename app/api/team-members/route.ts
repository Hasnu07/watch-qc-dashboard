import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWhatsAppMessage, toChatId } from '@/lib/greenapi'

async function getGreenAPISettings() {
  const [inst, tok, url] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'greenapi_instance_id' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_token' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_url' } }),
  ])
  if (!inst?.value || !tok?.value) return null
  return { instanceId: inst.value, token: tok.value, apiUrl: url?.value || 'https://api.green-api.com' }
}

export async function GET() {
  try {
    const members = await prisma.teamMember.findMany({
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(members)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, whatsapp_number, department } = body

    if (!name || !whatsapp_number) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const validDepts = ['LOGISTICS', 'ACCOUNTING', 'SALES']
    const dept = validDepts.includes(department) ? department : 'LOGISTICS'

    const cleanNumber = whatsapp_number.replace(/[^0-9]/g, '')

    const member = await prisma.teamMember.create({
      data: { name, whatsapp_number: cleanNumber, department: dept },
    })

    // Fire-and-forget welcome message
    getGreenAPISettings().then(settings => {
      if (!settings) return
      sendWhatsAppMessage(
        settings.instanceId, settings.token,
        toChatId(cleanNumber),
        `👋 Welcome to Watch QC Dashboard, ${name}! You've been added to the ${dept.charAt(0) + dept.slice(1).toLowerCase()} team.`,
        settings.apiUrl
      ).catch(console.error)
    }).catch(console.error)

    return NextResponse.json(member, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create team member' }, { status: 500 })
  }
}
