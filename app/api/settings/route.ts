import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SETTING_KEYS = [
  'greenapi_instance_id',
  'greenapi_api_token',
  'auto_message_time',
]

export async function GET() {
  try {
    const settings = await prisma.setting.findMany({
      where: { key: { in: SETTING_KEYS } },
    })

    const result: Record<string, string> = {
      greenapi_instance_id: '',
      greenapi_api_token: '',
      auto_message_time: '08:00',
    }

    for (const s of settings) {
      result[s.key] = s.value
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const updates = Object.entries(body).filter(([key]) =>
      SETTING_KEYS.includes(key)
    )

    await Promise.all(
      updates.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      )
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
