import { NextResponse } from 'next/server'
import { restoreQcData } from '@/lib/restore-qc-data'

export const dynamic = 'force-dynamic'

/** One-time restore after DB migration. Requires RESTORE_SECRET header when set. */
export async function POST(req: Request) {
  try {
    const secret = process.env.RESTORE_SECRET?.trim()
    if (secret) {
      const provided = req.headers.get('x-restore-secret')?.trim()
      if (provided !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const report = await restoreQcData()
    return NextResponse.json({ ok: true, report })
  } catch (err) {
    console.error('[restore-data]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
