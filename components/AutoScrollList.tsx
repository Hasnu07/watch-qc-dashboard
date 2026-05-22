'use client'

import { useRef, useEffect, useState } from 'react'

interface AutoScrollListProps {
  children: React.ReactNode
  className?: string
  speedPxPerSec?: number
}

export default function AutoScrollList({
  children,
  className = '',
  speedPxPerSec = 40,
}: AutoScrollListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)
  const posRef = useRef(0)
  const pausedRef = useRef(false)
  const [, forceRender] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    let lastTime: number | null = null

    const tick = (ts: number) => {
      if (lastTime == null) lastTime = ts
      const delta = ts - lastTime
      lastTime = ts

      if (!pausedRef.current) {
        const contentH = content.scrollHeight
        const containerH = container.clientHeight

        if (contentH > containerH) {
          posRef.current += (speedPxPerSec * delta) / 1000
          if (posRef.current >= contentH / 2) {
            posRef.current = 0
          }
          content.style.transform = `translateY(-${posRef.current}px)`
        }
      }

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current)
    }
  }, [speedPxPerSec])

  // Force re-render so clone picks up children changes
  useEffect(() => {
    forceRender((n) => n + 1)
  }, [children])

  const handleMouseEnter = () => { pausedRef.current = true }
  const handleMouseLeave = () => { pausedRef.current = false }

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={contentRef} className="will-change-transform">
        {children}
        {/* Duplicate content for seamless loop */}
        {children}
      </div>
    </div>
  )
}
