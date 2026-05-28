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
    <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-start justify-center pt-[15vh] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && isStock) { onSelectStock(ql); onClose() }
          }}
          placeholder="Search stock #, brand, model… (Enter stock # to add)"
          className="w-full px-5 py-4 text-base border-b border-slate-200 focus:outline-none"
        />
        <div className="p-2 max-h-64 overflow-y-auto">
          <button type="button" onClick={() => { onPaste(); onClose() }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium">📋 Paste WhatsApp message</button>
          <button type="button" onClick={() => { onAddWatch(); onClose() }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium">+ Add watch</button>
          {isStock && (
            <button type="button" onClick={() => { onSelectStock(ql); onClose() }}
              className="w-full text-left px-3 py-2 rounded-lg bg-indigo-50 text-indigo-800 text-sm font-bold">
              Add stock #{ql}
            </button>
          )}
          {matches.map(w => (
            <button key={w.id} type="button" onClick={() => { onOpenWatch(w.id); onClose() }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm">
              {w.stock_no && <span className="font-bold font-mono">#{w.stock_no} </span>}
              {w.brand} {w.model || w.name}
            </button>
          ))}
        </div>
        <p className="px-4 py-2 text-[10px] text-slate-400 border-t">⌘K / Ctrl+K · / search · n new watch</p>
      </div>
    </div>
  )
}
