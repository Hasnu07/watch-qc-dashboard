import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitWatchEvent } from '@/lib/events'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    const body = await req.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {}
    if (body.is_sold !== undefined) data.is_sold = body.is_sold
    if (body.stage !== undefined) data.stage = body.stage

    const watch = await prisma.watch.update({ where: { id }, data })

    if (watch.is_sold) {
      emitWatchEvent({ type: 'watch_sold', watchId: watch.id })
    } else {
      emitWatchEvent({ type: 'watch_updated', watchId: watch.id })
    }

    return NextResponse.json(watch)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update watch' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    await prisma.watch.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete watch' }, { status: 500 })
  }
}
