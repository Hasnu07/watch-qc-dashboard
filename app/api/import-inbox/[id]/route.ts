import { NextRequest, NextResponse } from 'next/server'
import { importWatchFromMessage } from '@/lib/import-watch-from-message'
import { dismissImportInbox } from '@/lib/import-inbox'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const item = await prisma.importInbox.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  if (action === 'dismiss') {
    await dismissImportInbox(id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'import') {
    const force = !!body.force
    const result = await importWatchFromMessage(item.message_text, item.image_url || undefined, {
      source: 'inbox',
      force,
      forceParse: force || item.skip_reason === 'not_a_transaction',
      inboxId: id,
    })
    if (!result.imported) {
      return NextResponse.json({ ...result, imported: false }, { status: 200 })
    }
    return NextResponse.json({ imported: true, watch: result.watch }, { status: 201 })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
