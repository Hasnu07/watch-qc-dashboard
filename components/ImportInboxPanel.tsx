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
    <div className="mb-4 rounded-xl border border-default bg-panel overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-left">
        <span className="text-sm font-medium text-ink">Review imports · {items.length}</span>
        <span className="text-muted text-xs">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="border-t border-default divide-y divide-default max-h-48 overflow-y-auto">
          {items.map(item => (
            <div key={item.id} className="px-5 py-4 text-xs">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-accent uppercase tracking-wide">{item.skip_reason}</span>
                <span className="text-muted">{new Date(item.created_at).toLocaleString()}</span>
              </div>
              <p className="text-ink line-clamp-2 font-mono mb-3 opacity-80">{item.message_text.slice(0, 200)}</p>
              <div className="flex gap-2">
                <button type="button" disabled={loading} onClick={() => act(item.id, 'import', item.skip_reason === 'duplicate' || item.skip_reason === 'not_a_transaction')}
                  className="btn-primary text-xs disabled:opacity-50">
                  Import{item.skip_reason === 'duplicate' || item.skip_reason === 'not_a_transaction' ? ' anyway' : ''}
                </button>
                <button type="button" disabled={loading} onClick={() => act(item.id, 'dismiss')}
                  className="btn-ghost text-xs">
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
