import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const VALID_TEAMS = ['LOGISTICS', 'ACCOUNTING', 'SALES', 'GRAPHICS', 'ADMIN', 'TRAVEL']

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    await prisma.teamMember.delete({ where: { id } }).catch(() => {})
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
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    const body = await req.json()
    const { name, whatsapp_number, team } = body

    const data: { name?: string; whatsapp_number?: string; team?: string | null } = {}
    if (name) data.name = name
    if (whatsapp_number) data.whatsapp_number = whatsapp_number.replace(/[^0-9]/g, '')
    if (team !== undefined) {
      const t = String(team || '').toUpperCase()
      if (t && !VALID_TEAMS.includes(t)) {
        return NextResponse.json({ error: 'Invalid team' }, { status: 400 })
      }
      data.team = t || null
    }

    // Reject duplicate numbers with a clear message (whatsapp_number is unique).
    if (data.whatsapp_number) {
      const clash = await prisma.teamMember.findFirst({
        where: { whatsapp_number: data.whatsapp_number, id: { not: id } },
        select: { name: true },
      })
      if (clash) {
        return NextResponse.json(
          { error: `That number is already used by ${clash.name}.` },
          { status: 409 },
        )
      }
    }

    const member = await prisma.teamMember.update({ where: { id }, data })
    return NextResponse.json(member)
  } catch (err) {
    // Prisma unique-constraint violation (race) → friendly message
    if (err && typeof err === 'object' && (err as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'That number is already used by another member.' },
        { status: 409 },
      )
    }
    console.error(err)
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
  }
}
