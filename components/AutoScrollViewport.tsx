'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

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
  speedPxPerSec = 36,
  pauseMs = 2500,
}: AutoScrollViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const singleRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)
  const posRef = useRef(0)
  const directionRef = useRef<1 | -1>(1)
  const pauseUntilRef = useRef(0)
  const pausedRef = useRef(false)
  const canScrollRef = useRef(false)
  const [canScroll, setCanScroll] = useState(false)

  const measure = useCallback(() => {
    const container = containerRef.current
    const single = singleRef.current
    if (!container || !single) return 0
    const max = single.scrollHeight - container.clientHeight
    const scrollable = max > 8
    if (scrollable !== canScrollRef.current) {
      canScrollRef.current = scrollable
      setCanScroll(scrollable)
    }
    return max
  }, [])

  useEffect(() => {
    measure()
    const t1 = setTimeout(measure, 100)
    const t2 = setTimeout(measure, 600)
    const t3 = setTimeout(measure, 1500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [children, measure])

  useEffect(() => {
    const container = containerRef.current
    const single = singleRef.current
    if (!container || !single || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measure())
    ro.observe(container)
    ro.observe(single)
    return () => ro.disconnect()
  }, [children, measure])

  useEffect(() => {
    if (!enabled) {
      posRef.current = 0
      directionRef.current = 1
      pauseUntilRef.current = 0
      if (contentRef.current) contentRef.current.style.transform = ''
      if (animRef.current != null) cancelAnimationFrame(animRef.current)
      return
    }

    posRef.current = 0
    directionRef.current = 1
    pauseUntilRef.current = 0
    if (contentRef.current) contentRef.current.style.transform = ''

    const content = contentRef.current
    if (!content) return

    let lastTime: number | null = null

    const tick = (ts: number) => {
      if (lastTime == null) lastTime = ts
      const delta = ts - lastTime
      lastTime = ts

      const maxScroll = measure()
      if (maxScroll > 8 && !pausedRef.current && ts >= pauseUntilRef.current) {
        posRef.current += directionRef.current * (speedPxPerSec * delta) / 1000

        if (posRef.current >= maxScroll) {
          posRef.current = maxScroll
          directionRef.current = -1
          pauseUntilRef.current = ts + pauseMs
        } else if (posRef.current <= 0) {
          posRef.current = 0
          directionRef.current = 1
          pauseUntilRef.current = ts + pauseMs
        }

        content.style.transform = `translateY(-${posRef.current}px)`
      }

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current)
    }
  }, [enabled, speedPxPerSec, pauseMs, measure])

  if (!enabled) {
    return (
      <div ref={containerRef} className={`overflow-y-auto min-h-0 ${className}`}>
        {children}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden relative min-h-0 ${className}`}
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false }}
    >
      <div ref={contentRef} className="will-change-transform">
        <div ref={singleRef}>{children}</div>
      </div>
      {!canScroll && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-3 py-1 rounded-full bg-card/90 border border-default text-muted">
          Add more watches to scroll
        </div>
      )}
    </div>
  )
}
