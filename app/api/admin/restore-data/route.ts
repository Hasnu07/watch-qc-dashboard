import { NextResponse } from 'next/server'
import { restoreQcData } from '@/lib/restore-qc-data'

export const dynamic = 'force-dynamic'

/** One-time restore after DB migration. Requires RESTORE_SECRET header when set. */
export async function POST(req: Request) {
  try {
    // Destructive (overwrites team/watches/tasks) — fail CLOSED. If no secret
    // is configured, the endpoint is disabled rather than left wide open.
    const secret = process.env.RESTORE_SECRET?.trim()
    if (!secret) {
      return NextResponse.json({ error: 'Restore is disabled (RESTORE_SECRET not set)' }, { status: 403 })
    }
    const provided = req.headers.get('x-restore-secret')?.trim()
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const report = await restoreQcData()
    return NextResponse.json({ ok: true, report })
  } catch (err) {
    console.error('[restore-data]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
