'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const LOCAL_MUTATION_MS = 3000

type WatchTaskSsePayload = {
  type: string
  watch_task_id?: number
  watch_id?: number
}

type UseWatchTasksLoaderOptions = {
  phase?: 'SELL'
  /** When false, skips fetch + SSE until the panel is shown (avoids loading 2000+ tasks on login). */
  enabled?: boolean
  /** Cap tasks to the N newest pipeline watches (default 60). */
  watchLimit?: number
}

export function useWatchTasksLoader(options: UseWatchTasksLoaderOptions = {}) {
  const { phase, enabled = true, watchLimit = 60 } = options
  const [tasks, setTasks] = useState<unknown[]>([])
  const [loading, setLoading] = useState(enabled)
  const recentMutations = useRef(new Set<number>())
  const fetchedRef = useRef(false)

  const listQuery = [
    phase === 'SELL' ? 'phase=SELL' : '',
    watchLimit > 0 ? `watch_limit=${watchLimit}` : '',
  ].filter(Boolean).join('&')
  const queryPrefix = listQuery ? `?${listQuery}` : ''

  const markLocalMutation = useCallback((taskId: number) => {
    recentMutations.current.add(taskId)
    window.setTimeout(() => recentMutations.current.delete(taskId), LOCAL_MUTATION_MS)
  }, [])

  const fetchAllTasks = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const res = await fetch(`/api/watch-tasks${queryPrefix}`)
      if (res.ok) setTasks(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [enabled, queryPrefix])

  const refreshWatchTasks = useCallback(async (watchId: number) => {
    if (!enabled) return
    try {
      const sep = queryPrefix ? '&' : '?'
      const res = await fetch(`/api/watch-tasks${queryPrefix}${sep}watch_id=${watchId}`)
      if (!res.ok) return
      const fresh: { watch_id: number }[] = await res.json()
      setTasks(prev => {
        const rest = (prev as { watch_id: number }[]).filter(t => t.watch_id !== watchId)
        return [...rest, ...fresh]
      })
    } catch (err) { console.error(err) }
  }, [enabled, queryPrefix])

  const handleSsePayload = useCallback((data: WatchTaskSsePayload) => {
    if (!enabled) return
    if (data.watch_task_id && recentMutations.current.has(data.watch_task_id)) return

    if (data.type === 'task_unlocked' && data.watch_task_id) {
      setTasks(prev => (prev as { id: number; is_locked?: boolean }[]).map(t =>
        t.id === data.watch_task_id ? { ...t, is_locked: false } : t
      ))
      return
    }

    if ((data.type === 'task_completed' || data.type === 'task_updated') && data.watch_id) {
      void refreshWatchTasks(data.watch_id)
      return
    }

    if (['new_watch', 'watch_updated', 'watch_sold'].includes(data.type)) {
      void fetchAllTasks()
    }
  }, [enabled, refreshWatchTasks, fetchAllTasks])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    if (fetchedRef.current) return
    fetchedRef.current = true
    // Defer heavy task fetch until after first paint so login → dashboard feels instant.
    let idleId: number | undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const run = () => { void fetchAllTasks() }
    if (typeof requestIdleCallback === 'function') {
      idleId = requestIdleCallback(run, { timeout: 1200 })
    } else {
      timeoutId = setTimeout(run, 400)
    }
    return () => {
      if (idleId != null && typeof cancelIdleCallback === 'function') cancelIdleCallback(idleId)
      if (timeoutId != null) clearTimeout(timeoutId)
    }
  }, [enabled, fetchAllTasks])

  useEffect(() => {
    if (!enabled) return
    let es: EventSource | null = null
    const connect = () => {
      es = new EventSource('/api/sse')
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WatchTaskSsePayload
          handleSsePayload(data)
        } catch { /* ignore pings */ }
      }
      es.onerror = () => { es?.close(); setTimeout(connect, 5000) }
    }
    connect()
    return () => es?.close()
  }, [enabled, handleSsePayload])

  return {
    tasks,
    setTasks,
    loading: enabled ? loading : false,
    fetchAllTasks,
    refreshWatchTasks,
    markLocalMutation,
  }
}
