import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitWatchEvent } from '@/lib/events'

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
    } = body

    if (website_price == null || b2b_price == null) {
      return NextResponse.json({ error: 'Website price and B2B price are required' }, { status: 400 })
    }

    // Auto-generate display name
    const nameParts = [brand, model].filter(Boolean)
    const name = nameParts.length > 0 ? nameParts.join(' ') : (ref_no || 'Unnamed Watch')

    const watch = await prisma.watch.create({
      data: {
        brand: brand || null,
        model: model || null,
        ref_no: ref_no || null,
        serial_no: serial_no || null,
        watch_date: watch_date || null,
        bought_from: bought_from || null,
        currency: currency || 'USD',
        purchase_price: purchase_price ? parseFloat(purchase_price) : null,
        convert_rate: convert_rate ? parseFloat(convert_rate) : null,
        case_material: case_material || null,
        dial_colour: dial_colour || null,
        bracelet: bracelet || null,
        stock_status: stock_status || 'STOCK',
        origin: origin || null,
        name,
        image_url: image_url || null,
        website_price: parseFloat(website_price),
        b2b_price: parseFloat(b2b_price),
      },
    })

    emitWatchEvent({ type: 'new_watch', watchId: watch.id })
    return NextResponse.json(watch, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create watch' }, { status: 500 })
  }
}
