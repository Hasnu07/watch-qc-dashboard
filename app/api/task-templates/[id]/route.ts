import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.default_assignee !== undefined) data.default_assignee = body.default_assignee || null
    if (body.label !== undefined) data.label = body.label
    const updated = await prisma.taskTemplate.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    await prisma.taskTemplate.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
