'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const LOCAL_MUTATION_MS = 3000

type WatchTaskSsePayload = {
  type: string
  watch_task_id?: number
  watch_id?: number
}

export function useWatchTasksLoader(phase?: 'SELL') {
  const [tasks, setTasks] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const recentMutations = useRef(new Set<number>())

  const listQuery = phase === 'SELL' ? '?phase=SELL' : ''

  const markLocalMutation = useCallback((taskId: number) => {
    recentMutations.current.add(taskId)
    window.setTimeout(() => recentMutations.current.delete(taskId), LOCAL_MUTATION_MS)
  }, [])

  const fetchAllTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/watch-tasks${listQuery}`)
      if (res.ok) setTasks(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [listQuery])

  const refreshWatchTasks = useCallback(async (watchId: number) => {
    try {
      const sep = listQuery ? '&' : '?'
      const res = await fetch(`/api/watch-tasks${listQuery}${sep}watch_id=${watchId}`)
      if (!res.ok) return
      const fresh: { watch_id: number }[] = await res.json()
      setTasks(prev => {
        const rest = (prev as { watch_id: number }[]).filter(t => t.watch_id !== watchId)
        return [...rest, ...fresh]
      })
    } catch (err) { console.error(err) }
  }, [listQuery])

  const handleSsePayload = useCallback((data: WatchTaskSsePayload) => {
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
  }, [refreshWatchTasks, fetchAllTasks])

  useEffect(() => { void fetchAllTasks() }, [fetchAllTasks])

  useEffect(() => {
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
  }, [handleSsePayload])

  return {
    tasks,
    setTasks,
    loading,
    fetchAllTasks,
    refreshWatchTasks,
    markLocalMutation,
  }
}
