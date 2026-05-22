import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    await prisma.teamMember.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    const body = await req.json()
    const { name, whatsapp_number } = body

    const data: { name?: string; whatsapp_number?: string } = {}
    if (name) data.name = name
    if (whatsapp_number) data.whatsapp_number = whatsapp_number.replace(/[^0-9]/g, '')

    const member = await prisma.teamMember.update({ where: { id }, data })
    return NextResponse.json(member)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
  }
}
