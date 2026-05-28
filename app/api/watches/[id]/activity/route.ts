import { NextResponse } from 'next/server'
import { getWatchActivities } from '@/lib/watch-activity'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const watchId = parseInt(params.id, 10)
  if (!Number.isFinite(watchId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  try {
    const activities = await getWatchActivities(watchId)
    return NextResponse.json(activities)
  } catch {
    return NextResponse.json([])
  }
}
