import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitWatchEvent } from '@/lib/events'
import { checkAndUnlockLocation } from '@/lib/watch-tasks'
import { logWatchActivity } from '@/lib/watch-activity'
import { requireSession, requireMaster } from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSession(req)
    if (session instanceof NextResponse) return session
    const forbidden = requireMaster(session)
    if (forbidden) return forbidden

    const id = parseInt(params.id, 10)
    const body = await req.json()
    const existing = await prisma.watch.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {}

    // Pipeline
    if (body.is_sold !== undefined) data.is_sold = body.is_sold
    if (body.stage !== undefined) data.stage = body.stage

    // Identity / purchase / details
    const editableStrings = [
      'brand','model','ref_no','serial_no','stock_no','watch_date',
      'bought_from','currency','case_material','dial_colour',
      'bracelet','stock_status','origin','image_url',
    ]
    for (const k of editableStrings) {
      if (body[k] !== undefined) data[k] = body[k] || null
    }
    if (body.purchase_price !== undefined) data.purchase_price = body.purchase_price ? parseFloat(body.purchase_price) : null
    if (body.convert_rate !== undefined)   data.convert_rate   = body.convert_rate   ? parseFloat(body.convert_rate)   : null
    if (body.website_price !== undefined)  data.website_price  = parseFloat(body.website_price)
    if (body.b2b_price !== undefined)      data.b2b_price      = parseFloat(body.b2b_price)
    if (body.total_amount !== undefined)   data.total_amount   = body.total_amount ? parseFloat(body.total_amount) : null

    // Payment status
    if (body.payment_status !== undefined) data.payment_status = body.payment_status

    // Location
    if (body.location_status !== undefined) {
      data.location_status = body.location_status
      if (body.location_status === 'IN_STOCK') {
        if (!existing.received_date) data.received_date = new Date()
      }
    }
    if (body.location_from !== undefined)           data.location_from           = body.location_from || null
    if (body.location_to !== undefined)             data.location_to             = body.location_to || null
    if (body.transit_pickup_date !== undefined)     data.transit_pickup_date     = body.transit_pickup_date ? new Date(body.transit_pickup_date) : null
    if (body.transit_carrier !== undefined)         data.transit_carrier         = body.transit_carrier || null
    if (body.transit_tracking_number !== undefined) data.transit_tracking_number = body.transit_tracking_number || null
    if (body.received_date !== undefined)           data.received_date           = body.received_date ? new Date(body.received_date) : null

    const watch = await prisma.watch.update({ where: { id }, data })

    if (data.payment_status !== undefined && data.payment_status !== existing.payment_status) {
      logWatchActivity(id, 'payment_status', `${existing.payment_status} → ${data.payment_status}`).catch(console.error)
    }
    if (data.location_status !== undefined && data.location_status !== existing.location_status) {
      logWatchActivity(id, 'location_updated', `${existing.location_status} → ${data.location_status}`).catch(console.error)
    } else if (
      (data.location_from !== undefined && data.location_from !== existing.location_from) ||
      (data.location_to !== undefined && data.location_to !== existing.location_to)
    ) {
      logWatchActivity(id, 'location_updated', [data.location_from ?? existing.location_from, data.location_to ?? existing.location_to].filter(Boolean).join(' → ')).catch(console.error)
    }

    // If payment status changed, check if location task should unlock
    if (data.payment_status !== undefined) {
      checkAndUnlockLocation(id).catch(console.error)
    }

    emitWatchEvent({ type: 'watch_updated', watchId: watch.id })

    return NextResponse.json(watch)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update watch' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSession(req)
    if (session instanceof NextResponse) return session
    const forbidden = requireMaster(session)
    if (forbidden) return forbidden

    const id = parseInt(params.id, 10)
    await prisma.watch.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete watch' }, { status: 500 })
  }
}
