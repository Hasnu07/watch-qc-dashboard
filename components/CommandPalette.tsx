'use client'

import { useEffect, useState } from 'react'

interface Props {
  watches: Array<{ id: number; stock_no: string | null; name: string; brand: string | null; model: string | null }>
  onClose: () => void
  onSelectStock: (stock: string) => void
  onPaste: () => void
  onAddWatch: () => void
  onOpenWatch: (id: number) => void
}

export default function CommandPalette({ watches, onClose, onSelectStock, onPaste, onAddWatch, onOpenWatch }: Props) {
  const [q, setQ] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const ql = q.toLowerCase().trim()
  const matches = ql
    ? watches.filter(w => {
        const hay = [w.stock_no, w.brand, w.model, w.name].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(ql)
      }).slice(0, 8)
    : []

  const isStock = /^\d+$/.test(ql)

  return (
    <div className="fixed inset-0 bg-ink/40 z-[70] flex items-start justify-center pt-[15vh] p-4" onClick={onClose}>
      <div className="card w-full max-w-lg shadow-none" onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && isStock) { onSelectStock(ql); onClose() }
          }}
          placeholder="Search stock #, brand, model…"
          className="w-full px-6 py-5 text-base border-b border-default bg-transparent focus:outline-none font-display tracking-wide"
        />
        <div className="p-3 max-h-64 overflow-y-auto space-y-1">
          <button type="button" onClick={() => { onPaste(); onClose() }} className="w-full text-left px-4 py-2.5 rounded-2xl hover:bg-panel text-sm font-medium">Paste WhatsApp message</button>
          <button type="button" onClick={() => { onAddWatch(); onClose() }} className="w-full text-left px-4 py-2.5 rounded-2xl hover:bg-panel text-sm font-medium">Add watch</button>
          {isStock && (
            <button type="button" onClick={() => { onSelectStock(ql); onClose() }}
              className="w-full text-left px-4 py-2.5 rounded-2xl bg-accent/10 text-accent text-sm font-semibold">
              Add stock #{ql}
            </button>
          )}
          {matches.map(w => (
            <button key={w.id} type="button" onClick={() => { onOpenWatch(w.id); onClose() }}
              className="w-full text-left px-4 py-2.5 rounded-2xl hover:bg-panel text-sm">
              {w.stock_no && <span className="font-semibold font-mono-data">#{w.stock_no} </span>}
              {w.brand} {w.model || w.name}
            </button>
          ))}
        </div>
        <p className="px-5 py-3 text-[10px] text-muted border-t border-default uppercase tracking-widest">⌘K · / search · n new watch</p>
      </div>
    </div>
  )
}
