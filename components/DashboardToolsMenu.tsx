'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onCommandPalette: () => void
  onPaste: () => void
  onTvScroll: () => void
  onBulkFetch?: () => void
  bulkFetching?: boolean
  missingImageCount?: number
  inventoryTvScroll?: boolean
}

export default function DashboardToolsMenu({
  onCommandPalette,
  onPaste,
  onTvScroll,
  onBulkFetch,
  bulkFetching,
  missingImageCount = 0,
  inventoryTvScroll,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="btn-ghost text-sm px-3"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Tools
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[11rem] rounded-xl border border-default bg-card shadow-lg py-1">
          <button type="button" className="menu-item" onClick={() => { setOpen(false); onCommandPalette() }}>
            Search (⌘K)
          </button>
          <button type="button" className="menu-item" onClick={() => { setOpen(false); onPaste() }}>
            Paste message
          </button>
          <a href="/api/watches/export" download className="menu-item block" onClick={() => setOpen(false)}>
            Export CSV
          </a>
          {missingImageCount > 0 && onBulkFetch && (
            <button type="button" className="menu-item" disabled={bulkFetching}
              onClick={() => { setOpen(false); onBulkFetch() }}>
              {bulkFetching ? 'Fetching images…' : `Fetch ${missingImageCount} images`}
            </button>
          )}
          <button type="button" className="menu-item" onClick={() => { setOpen(false); onTvScroll() }}>
            {inventoryTvScroll ? 'Exit TV mode' : 'TV scroll mode'}
          </button>
        </div>
      )}
    </div>
  )
}
