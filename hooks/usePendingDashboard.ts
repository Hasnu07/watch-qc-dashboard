'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  MemberPending,
  PendingDashboardResponse,
  PendingFilter,
  UnassignedPending,
} from '@/lib/pending-dashboard'
import { memberMatchesFilter, unassignedMatchesFilter } from '@/lib/pending-dashboard'

export function usePendingDashboard() {
  const [data, setData] = useState<PendingDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => new Date())

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/pending-tasks-by-member')
      if (!res.ok) throw new Error('fetch failed')
      const json: PendingDashboardResponse = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let es: EventSource | null = null
    try {
      es = new EventSource('/api/sse')
      es.onmessage = () => fetchData()
    } catch { /* ignore */ }
    return () => es?.close()
  }, [fetchData])

  return { data, loading, now, refresh: fetchData }
}

export type { PendingFilter, MemberPending, UnassignedPending, PendingDashboardResponse }
