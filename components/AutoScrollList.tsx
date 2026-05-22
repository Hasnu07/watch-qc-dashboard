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
  const singleRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)
  const posRef = useRef(0)
  const pausedRef = useRef(false)
  const [shouldLoop, setShouldLoop] = useState(false)

  // Check whether content overflows the container — only then duplicate + scroll
  useEffect(() => {
    const check = () => {
      const container = containerRef.current
      const single = singleRef.current
      if (!container || !single) return
      setShouldLoop(single.scrollHeight > container.clientHeight)
    }
    check()
    // Re-check after layout settles (images, fonts, etc.)
    const t = setTimeout(check, 150)
    return () => clearTimeout(t)
  }, [children])

  // Animation — only runs when shouldLoop is true
  useEffect(() => {
    if (!shouldLoop) {
      posRef.current = 0
      if (contentRef.current) contentRef.current.style.transform = ''
      return
    }

    const container = containerRef.current
    const content = contentRef.current
    const single = singleRef.current
    if (!container || !content || !single) return

    let lastTime: number | null = null

    const tick = (ts: number) => {
      if (lastTime == null) lastTime = ts
      const delta = ts - lastTime
      lastTime = ts

      if (!pausedRef.current) {
        posRef.current += (speedPxPerSec * delta) / 1000
        // Loop back when we've scrolled one full copy
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
  }, [shouldLoop, speedPxPerSec])

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
        {/* Primary copy — always rendered, used for height measurement */}
        <div ref={singleRef}>{children}</div>
        {/* Duplicate copy — only rendered when content overflows (seamless loop) */}
        {shouldLoop && <div aria-hidden="true">{children}</div>}
      </div>
    </div>
  )
}
