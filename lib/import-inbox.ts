import { prisma } from './prisma'
import type { ParsedWatch } from './parse-whatsapp-watch'

export async function saveImportInbox(params: {
  source?: string
  message_text: string
  image_url?: string | null
  skip_reason: string
  parsed?: ParsedWatch | null
  watch_id?: number | null
  status?: 'pending' | 'imported' | 'dismissed'
}) {
  try {
    return await prisma.importInbox.create({
      data: {
        source: params.source || 'webhook',
        message_text: params.message_text.slice(0, 8000),
        image_url: params.image_url || null,
        skip_reason: params.skip_reason,
        parsed_json: params.parsed ? JSON.parse(JSON.stringify(params.parsed)) : undefined,
        status: params.status || 'pending',
        watch_id: params.watch_id || null,
      },
    })
  } catch (err) {
    console.error('[ImportInbox]', err)
    return null
  }
}

export async function listPendingImportInbox(limit = 30) {
  return prisma.importInbox.findMany({
    where: { status: 'pending' },
    orderBy: { created_at: 'desc' },
    take: limit,
  })
}

export async function dismissImportInbox(id: number) {
  return prisma.importInbox.update({ where: { id }, data: { status: 'dismissed' } })
}

export async function dismissAllImportInbox() {
  return prisma.importInbox.updateMany({
    where: { status: 'pending' },
    data: { status: 'dismissed' },
  })
}

export async function markImportInboxImported(id: number, watchId: number) {
  return prisma.importInbox.update({
    where: { id },
    data: { status: 'imported', watch_id: watchId },
  })
}
