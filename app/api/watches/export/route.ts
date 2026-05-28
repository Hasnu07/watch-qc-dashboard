import { NextResponse } from 'next/server'
import { getVisibleWatches } from '@/lib/watch-visibility'

export const dynamic = 'force-dynamic'

export async function GET() {
  const watches = await getVisibleWatches()
  const header = [
    'id', 'stock_no', 'watch_type', 'brand', 'model', 'ref_no', 'bought_from', 'sold_to',
    'purchase_price', 'website_price', 'payment_status', 'location_status', 'created_at',
  ]
  const rows = watches.map(w => [
    w.id,
    w.stock_no || '',
    w.watch_type,
    w.brand || '',
    w.model || '',
    w.ref_no || '',
    w.bought_from || '',
    w.sold_to || '',
    w.purchase_price?.toString() || '',
    w.website_price?.toString() || '',
    w.payment_status,
    w.location_status,
    w.created_at.toISOString(),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))

  const csv = [header.join(','), ...rows].join('\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="pipeline-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
