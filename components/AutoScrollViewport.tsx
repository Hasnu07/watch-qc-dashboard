'use client'

import { useRef, useEffect } from 'react'

interface AutoScrollViewportProps {
  children: React.ReactNode
  className?: string
  enabled?: boolean
  speedPxPerSec?: number
  pauseMs?: number
}

export default function AutoScrollViewport({
  children,
  className = '',
  enabled = false,
  speedPxPerSec = 32,
  pauseMs = 2500,
}: AutoScrollViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)
  const directionRef = useRef<1 | -1>(1)
  const pauseUntilRef = useRef(0)
  const pausedRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      if (animRef.current != null) cancelAnimationFrame(animRef.current)
      return
    }

    const el = containerRef.current
    if (!el) return

    let lastTime: number | null = null

    const tick = (ts: number) => {
      if (lastTime == null) lastTime = ts
      const delta = ts - lastTime
      lastTime = ts

      if (!pausedRef.current && ts >= pauseUntilRef.current) {
        const maxScroll = el.scrollHeight - el.clientHeight
        if (maxScroll > 4) {
          el.scrollTop += directionRef.current * (speedPxPerSec * delta) / 1000

          if (el.scrollTop >= maxScroll) {
            el.scrollTop = maxScroll
            directionRef.current = -1
            pauseUntilRef.current = ts + pauseMs
          } else if (el.scrollTop <= 0) {
            el.scrollTop = 0
            directionRef.current = 1
            pauseUntilRef.current = ts + pauseMs
          }
        }
      }

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current)
    }
  }, [enabled, speedPxPerSec, pauseMs, children])

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false }}
    >
      {children}
    </div>
  )
}
