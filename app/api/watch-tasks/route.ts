import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { visibleWatchFilter } from '@/lib/watch-visibility'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const department = searchParams.get('department')
    const watchId = searchParams.get('watch_id')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (department) where.department = department
    if (watchId) where.watch_id = parseInt(watchId, 10)

    const phase = searchParams.get('phase')
    const visibleFilter = await visibleWatchFilter()

    if (phase) {
      where.phase = phase
      if (phase === 'SELL') {
        where.watch = { ...visibleFilter, watch_type: 'SELL' }
      } else {
        where.watch = { ...visibleFilter, watch_type: { not: 'SELL' } }
      }
    } else {
      where.watch = { ...visibleFilter, watch_type: { not: 'SELL' } }
      where.phase = { not: 'SELL' }
    }

    const tasks = await prisma.watchTask.findMany({
      where,
      include: {
        watch: {
          select: {
            id: true, name: true, brand: true, model: true, ref_no: true, stock_no: true, fob_url: true,
            payment_status: true, website_price: true, b2b_price: true,
            logistics_cost: true, logistics_cost_currency: true,
          },
        },
      },
      orderBy: [{ watch_id: 'asc' }, { id: 'asc' }],
    })

    return NextResponse.json(tasks)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}
