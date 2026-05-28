import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitWatchEvent } from '@/lib/events'
import { createWatchTasks } from '@/lib/watch-tasks'
import { createWatchSellTasks } from '@/lib/sell-tasks'
import { getVisibleWatches } from '@/lib/watch-visibility'

export async function GET() {
  try {
    const watches = await getVisibleWatches()

    const buyIds = watches.filter(w => w.watch_type !== 'SELL').map(w => w.id)
    const sellIds = watches.filter(w => w.watch_type === 'SELL').map(w => w.id)
    const [buyTasks, sellTasks] = await Promise.all([
      buyIds.length
        ? prisma.watchTask.findMany({
            where: { watch_id: { in: buyIds }, phase: { not: 'SELL' } },
            select: { watch_id: true, department: true, is_completed: true },
          })
        : Promise.resolve([]),
      sellIds.length
        ? prisma.watchTask.findMany({
            where: { watch_id: { in: sellIds }, phase: 'SELL' },
            select: { watch_id: true, department: true, is_completed: true },
          })
        : Promise.resolve([]),
    ])
    const tasks = [...buyTasks, ...sellTasks]

    type Summary = Record<'LOGISTICS' | 'ACCOUNTING' | 'SALES', { total: number; completed: number }>
    const blank = (): Summary => ({
      LOGISTICS: { total: 0, completed: 0 },
      ACCOUNTING: { total: 0, completed: 0 },
      SALES: { total: 0, completed: 0 },
    })
    const byWatch = new Map<number, Summary>()
    for (const t of tasks) {
      if (!byWatch.has(t.watch_id)) byWatch.set(t.watch_id, blank())
      const s = byWatch.get(t.watch_id)!
      const dept = t.department as keyof Summary
      s[dept].total++
      if (t.is_completed) s[dept].completed++
    }

    const enriched = watches.map(w => ({ ...w, task_summary: byWatch.get(w.id) ?? blank() }))
    return NextResponse.json(enriched)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch watches' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      brand, model, ref_no, serial_no, stock_no, watch_date,
      bought_from, sold_to, currency, purchase_price, convert_rate,
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
        stock_no: stock_no || null,
        watch_date: watch_date || null,
        bought_from: bought_from || null,
        sold_to: sold_to || null,
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
