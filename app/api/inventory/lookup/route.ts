import { NextRequest, NextResponse } from 'next/server'
import { inventoryLookupForApi } from '@/lib/inventory-csv'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const stockNo = new URL(req.url).searchParams.get('stock_no')?.trim()
  if (!stockNo) {
    return NextResponse.json({ error: 'stock_no is required' }, { status: 400 })
  }

  const record = inventoryLookupForApi(stockNo)
  if (!record) {
    return NextResponse.json({ found: false, stock_no: stockNo.replace(/^#/, '') })
  }

  return NextResponse.json({ found: true, ...record })
}
