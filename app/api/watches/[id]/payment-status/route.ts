import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitWatchEvent } from '@/lib/events'
import { checkAndUnlockLocation } from '@/lib/watch-tasks'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    const { payment_status } = await req.json()
    if (!payment_status) return NextResponse.json({ error: 'payment_status required' }, { status: 400 })
    const watch = await prisma.watch.update({
      where: { id },
      data: { payment_status },
    })
    emitWatchEvent({ type: 'watch_updated', watchId: watch.id })
    // Check if location task should unlock
    checkAndUnlockLocation(id).catch(console.error)
    return NextResponse.json(watch)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update payment status' }, { status: 500 })
  }
}
