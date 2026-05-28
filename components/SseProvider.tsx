'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'

interface SseContextValue {
  connected: boolean
}

const SseContext = createContext<SseContextValue>({ connected: false })

export function useSseStatus() {
  return useContext(SseContext)
}

export function SseProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const onEvent = useCallback(() => {
    window.dispatchEvent(new CustomEvent('qc-dashboard-refresh'))
  }, [])

  useEffect(() => {
    let es: EventSource | null = null
    const connect = () => {
      es = new EventSource('/api/sse')
      es.onopen = () => {
        setConnected(true)
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      }
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (['new_watch', 'watch_updated', 'watch_sold', 'task_completed', 'task_updated', 'task_unlocked'].includes(data.type)) {
            onEvent()
          }
        } catch { /* ping */ }
      }
      es.onerror = () => {
        setConnected(false)
        es?.close()
        if (!pollRef.current) pollRef.current = setInterval(onEvent, 10000)
        setTimeout(connect, 5000)
      }
    }
    connect()
    return () => {
      es?.close()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [onEvent])

  return (
    <SseContext.Provider value={{ connected }}>
      {children}
    </SseContext.Provider>
  )
}
