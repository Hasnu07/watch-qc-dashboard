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

    if (body.location_status !== undefined) {
      data.location_status = body.location_status
      if (body.location_status === 'IN_STOCK') {
        const existing = await prisma.watch.findUnique({ where: { id }, select: { received_date: true } })
        if (!existing?.received_date) data.received_date = new Date()
      }
    }
    if (body.location_from !== undefined)           data.location_from           = body.location_from || null
    if (body.location_to !== undefined)             data.location_to             = body.location_to || null
    if (body.transit_pickup_date !== undefined)     data.transit_pickup_date     = body.transit_pickup_date ? new Date(body.transit_pickup_date) : null
    if (body.transit_carrier !== undefined)         data.transit_carrier         = body.transit_carrier || null
    if (body.transit_tracking_number !== undefined) data.transit_tracking_number = body.transit_tracking_number || null

    const watch = await prisma.watch.update({ where: { id }, data })
    emitWatchEvent({ type: 'watch_updated', watchId: watch.id })
    return NextResponse.json(watch)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 })
  }
}
