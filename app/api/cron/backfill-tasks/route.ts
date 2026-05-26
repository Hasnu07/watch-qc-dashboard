// One-time backfill endpoint — adds any missing default tasks to existing watches.
// Safe to call multiple times (uses createMany with skipDuplicates).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULT_TASKS = [
  { department: 'ACCOUNTING', task_type: 'ACCOUNTING_MARK_PAYMENT', phase: 'BUY', is_locked: false },
  { department: 'ACCOUNTING', task_type: 'ACCOUNTING_ADD_STOCK_FOB', phase: 'BUY', is_locked: false },
  { department: 'SALES',      task_type: 'SALES_SET_PRICE',          phase: 'BUY', is_locked: false },
  { department: 'SALES',      task_type: 'SALES_UPLOAD_DRIVE',       phase: 'BUY', is_locked: false },
  { department: 'SALES',      task_type: 'SALES_UPLOAD_STOCK_GROUP', phase: 'BUY', is_locked: false },
  { department: 'SALES',      task_type: 'SALES_UPDATE_B2B',         phase: 'BUY', is_locked: false },
  { department: 'SALES',      task_type: 'SALES_GET_B2C_PRICES',     phase: 'BUY', is_locked: false },
  { department: 'LOGISTICS',  task_type: 'LOGISTICS_SET_LOCATION',   phase: 'BUY', is_locked: true  },
  { department: 'LOGISTICS',  task_type: 'LOGISTICS_UPDATE_COST',    phase: 'BUY', is_locked: false },
  { department: 'LOGISTICS',  task_type: 'LOGISTICS_ACCESSORIES_BOX',           phase: 'BUY', is_locked: false },
  { department: 'LOGISTICS',  task_type: 'LOGISTICS_ACCESSORIES_PAPERS',        phase: 'BUY', is_locked: false },
  { department: 'LOGISTICS',  task_type: 'LOGISTICS_ACCESSORIES_EXTRA_LINKS',   phase: 'BUY', is_locked: false },
  { department: 'LOGISTICS',  task_type: 'LOGISTICS_ACCESSORIES_WARRANTY_CARD', phase: 'BUY', is_locked: false },
  { department: 'LOGISTICS',  task_type: 'LOGISTICS_ACCESSORIES_HANG_TAG',      phase: 'BUY', is_locked: false },
]

export async function POST() {
  try {
    // Get all non-sold BUY-type watches
    const watches = await prisma.watch.findMany({
      where: { is_sold: false, watch_type: { not: 'SELL' } },
      select: { id: true },
    })

    let added = 0
    for (const watch of watches) {
      // Find which task_types this watch is missing
      const existing = await prisma.watchTask.findMany({
        where: { watch_id: watch.id },
        select: { task_type: true },
      })
      const existingTypes = new Set(existing.map(t => t.task_type))
      const missing = DEFAULT_TASKS.filter(t => !existingTypes.has(t.task_type))

      if (missing.length > 0) {
        await prisma.watchTask.createMany({
          data: missing.map(t => ({ ...t, watch_id: watch.id })),
          skipDuplicates: true,
        })
        added += missing.length
      }
    }

    return NextResponse.json({ ok: true, watches: watches.length, tasks_added: added })
  } catch (err) {
    console.error('[backfill-tasks]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
