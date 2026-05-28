'use client'

import { useRef, useEffect, useState } from 'react'

interface AutoScrollViewportProps {
  children: React.ReactNode
  className?: string
  innerClassName?: string
  enabled?: boolean
  speedPxPerSec?: number
  pauseMs?: number
}

export default function AutoScrollViewport({
  children,
  className = '',
  innerClassName = '',
  enabled = false,
  speedPxPerSec = 40,
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
  const [shouldScroll, setShouldScroll] = useState(false)

  const measure = () => {
    const container = containerRef.current
    const single = singleRef.current
    if (!container || !single) return
    setShouldScroll(single.scrollHeight > container.clientHeight + 4)
  }

  useEffect(() => {
    measure()
    const t1 = setTimeout(measure, 100)
    const t2 = setTimeout(measure, 500)
    const t3 = setTimeout(measure, 1500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [children, enabled])

  useEffect(() => {
    const container = containerRef.current
    const single = singleRef.current
    if (!container || !single || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measure())
    ro.observe(container)
    ro.observe(single)
    return () => ro.disconnect()
  }, [children, enabled])

  useEffect(() => {
    if (!enabled || !shouldScroll) {
      posRef.current = 0
      directionRef.current = 1
      pauseUntilRef.current = 0
      if (contentRef.current) contentRef.current.style.transform = ''
      if (animRef.current != null) cancelAnimationFrame(animRef.current)
      return
    }

    posRef.current = 0
    directionRef.current = 1
    pauseUntilRef.current = performance.now() + 800

    const content = contentRef.current
    const container = containerRef.current
    if (!content || !container) return

    let lastTime: number | null = null

    const tick = (ts: number) => {
      if (lastTime == null) lastTime = ts
      const delta = ts - lastTime
      lastTime = ts

      const maxScroll = container.scrollHeight > 0
        ? singleRef.current!.scrollHeight - container.clientHeight
        : 0

      if (maxScroll > 4 && !pausedRef.current && ts >= pauseUntilRef.current) {
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
  }, [enabled, shouldScroll, speedPxPerSec, pauseMs])

  return (
    <div
      ref={containerRef}
      className={`relative min-h-0 h-0 flex-1 ${enabled ? 'overflow-hidden' : 'overflow-y-auto'} ${className}`}
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false }}
    >
      <div ref={contentRef} className={enabled ? 'will-change-transform' : undefined}>
        <div ref={singleRef} className={innerClassName}>
          {children}
        </div>
      </div>
      {enabled && !shouldScroll && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-3 py-1 rounded-full bg-card/90 border border-default text-muted">
          Add more watches to scroll
        </div>
      )}
    </div>
  )
}
