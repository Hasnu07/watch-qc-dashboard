import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitWatchEvent } from '@/lib/events'
import { createWatchTasks } from '@/lib/watch-tasks'
import { createWatchSellTasks } from '@/lib/sell-tasks'

export async function GET() {
  try {
    const watches = await prisma.watch.findMany({
      where: { is_sold: false },
      orderBy: { created_at: 'desc' },
    })
    return NextResponse.json(watches)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch watches' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      brand, model, ref_no, serial_no, watch_date,
      bought_from, currency, purchase_price, convert_rate,
      case_material, dial_colour, bracelet,
      stock_status, origin,
      image_url, website_price, b2b_price,
      payment_status,
      total_amount,
      location_status,
      location_from, location_to,
      transit_pickup_date, transit_carrier, transit_tracking_number,
      watch_type,
    } = body

    if (website_price == null || b2b_price == null) {
      return NextResponse.json({ error: 'Website price and B2B price are required' }, { status: 400 })
    }

    const nameParts = [brand, model].filter(Boolean)
    const name = nameParts.length > 0 ? nameParts.join(' ') : (ref_no || 'Unnamed Watch')

    // Calculate USD total_amount if not provided
    const pp = purchase_price ? parseFloat(purchase_price) : null
    const cr = convert_rate ? parseFloat(convert_rate) : null
    const computedTotal = total_amount
      ? parseFloat(total_amount)
      : pp
        ? (currency === 'USD' || !cr ? pp : +(pp * cr).toFixed(2))
        : null

    // Set received_date if location is IN_STOCK
    const locStatus = location_status || 'INCOMING'
    const receivedDate = locStatus === 'IN_STOCK' ? new Date() : null

    const watch = await prisma.watch.create({
      data: {
        brand: brand || null,
        model: model || null,
        ref_no: ref_no || null,
        serial_no: serial_no || null,
        watch_date: watch_date || null,
        bought_from: bought_from || null,
        currency: currency || 'USD',
        purchase_price: pp,
        convert_rate: cr,
        case_material: case_material || null,
        dial_colour: dial_colour || null,
        bracelet: bracelet || null,
        stock_status: stock_status || 'STOCK',
        origin: origin || null,
        watch_type: watch_type || 'BUY',
        name,
        image_url: image_url || null,
        website_price: parseFloat(website_price),
        b2b_price: parseFloat(b2b_price),
        payment_status: payment_status || 'NOT_PAID',
        total_amount: computedTotal,
        location_status: locStatus,
        location_from: location_from || null,
        location_to: location_to || null,
        transit_pickup_date: transit_pickup_date ? new Date(transit_pickup_date) : null,
        transit_carrier: transit_carrier || null,
        transit_tracking_number: transit_tracking_number || null,
        received_date: receivedDate,
      },
    })

    emitWatchEvent({ type: 'new_watch', watchId: watch.id })
    // Create tasks based on type — BUY gets buy tasks, SELL gets sell tasks immediately
    if (watch.watch_type === 'SELL') {
      createWatchSellTasks(watch.id, watch.name).catch(console.error)
    } else {
      createWatchTasks(watch.id, watch.name).catch(console.error)
    }
    return NextResponse.json(watch, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create watch' }, { status: 500 })
  }
}
