'use client'

import { useRef, useEffect, useState } from 'react'

interface AutoScrollListProps {
  children: React.ReactNode
  className?: string
  speedPxPerSec?: number
  enabled?: boolean
}

export default function AutoScrollList({
  children,
  className = '',
  speedPxPerSec = 40,
  enabled = true,
}: AutoScrollListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const singleRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)
  const posRef = useRef(0)
  const pausedRef = useRef(false)
  const [shouldLoop, setShouldLoop] = useState(false)

  const measure = () => {
    const container = containerRef.current
    const single = singleRef.current
    if (!container || !single) return
    setShouldLoop(single.scrollHeight > container.clientHeight + 4)
  }

  useEffect(() => {
    measure()
    const t = setTimeout(measure, 150)
    const t2 = setTimeout(measure, 500)
    return () => { clearTimeout(t); clearTimeout(t2) }
  }, [children, enabled])

  useEffect(() => {
    const single = singleRef.current
    const container = containerRef.current
    if (!single || !container || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measure())
    ro.observe(single)
    ro.observe(container)
    return () => ro.disconnect()
  }, [children, enabled])

  useEffect(() => {
    if (!enabled || !shouldLoop) {
      posRef.current = 0
      if (contentRef.current) contentRef.current.style.transform = ''
      return
    }

    const content = contentRef.current
    const single = singleRef.current
    if (!content || !single) return

    let lastTime: number | null = null

    const tick = (ts: number) => {
      if (lastTime == null) lastTime = ts
      const delta = ts - lastTime
      lastTime = ts

      if (!pausedRef.current) {
        posRef.current += (speedPxPerSec * delta) / 1000
        if (posRef.current >= single.scrollHeight) {
          posRef.current = 0
        }
        content.style.transform = `translateY(-${posRef.current}px)`
      }

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current)
    }
  }, [enabled, shouldLoop, speedPxPerSec])

  const handleMouseEnter = () => { pausedRef.current = true }
  const handleMouseLeave = () => { pausedRef.current = false }

  if (!enabled) {
    return <div className={`overflow-y-auto min-h-0 ${className}`}>{children}</div>
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden relative min-h-0 ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={contentRef} className="will-change-transform">
        <div ref={singleRef}>{children}</div>
        {shouldLoop && <div aria-hidden="true">{children}</div>}
      </div>
    </div>
  )
}
