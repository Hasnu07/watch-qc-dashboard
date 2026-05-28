'use client'

import { useEffect, useState, useCallback } from 'react'

interface InboxItem {
  id: number
  message_text: string
  image_url: string | null
  skip_reason: string
  created_at: string
  parsed_json?: Record<string, unknown> | null
  watch_id?: number | null
}

interface Props {
  onImported: () => void
}

export default function ImportInboxPanel({ onImported }: Props) {
  const [items, setItems] = useState<InboxItem[]>([])
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(false)

  const fetchInbox = useCallback(async () => {
    try {
      const res = await fetch('/api/import-inbox')
      if (res.ok) setItems(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchInbox() }, [fetchInbox])

  const act = async (id: number, action: 'import' | 'dismiss', force = false) => {
    setLoading(true)
    try {
      await fetch(`/api/import-inbox/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, force }),
      })
      await fetchInbox()
      onImported()
    } finally { setLoading(false) }
  }

  if (items.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border-2 border-amber-200 bg-amber-50 overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-left">
        <span className="text-sm font-black text-amber-900">📥 Import inbox · {items.length} need review</span>
        <span className="text-amber-600 text-xs">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="border-t border-amber-200 divide-y divide-amber-100 max-h-48 overflow-y-auto">
          {items.map(item => (
            <div key={item.id} className="px-4 py-3 text-xs">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-amber-800 uppercase">{item.skip_reason}</span>
                <span className="text-amber-600">{new Date(item.created_at).toLocaleString()}</span>
              </div>
              <p className="text-amber-900 line-clamp-2 font-mono mb-2">{item.message_text.slice(0, 200)}</p>
              <div className="flex gap-2">
                <button type="button" disabled={loading} onClick={() => act(item.id, 'import', item.skip_reason === 'duplicate')}
                  className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-50">
                  Import{item.skip_reason === 'duplicate' ? ' anyway' : ''}
                </button>
                <button type="button" disabled={loading} onClick={() => act(item.id, 'dismiss')}
                  className="px-3 py-1 rounded-lg border border-amber-300 text-amber-800 font-bold">
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
