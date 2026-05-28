'use client'

import { useState } from 'react'

interface Props {
  onClose: () => void
  onImported: () => void
  onViewWatch?: (watchId: number) => void
}

interface ParsedPreview {
  type?: string | null
  brand?: string | null
  model?: string | null
  ref_no?: string | null
  stock_no?: string | null
  bought_from?: string | null
  sold_to?: string | null
  price?: number | null
  currency?: string | null
  payment_status?: string | null
  inventory_matched?: boolean
}

export default function PasteMessageModal({ onClose, onImported, onViewWatch }: Props) {
  const [text, setText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ParsedPreview | null>(null)
  const [skipped, setSkipped] = useState<string | null>(null)
  const [importedWatchId, setImportedWatchId] = useState<number | null>(null)
  const [success, setSuccess] = useState(false)

  const handleImport = async () => {
    setError(''); setSkipped(null); setPreview(null); setSuccess(false); setImportedWatchId(null); setLoading(true)
    try {
      const res = await fetch('/api/watches/import-from-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, imageUrl: imageUrl || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to import')
        return
      }
      if (!data.imported) {
        setSkipped(data.skipped || 'unknown')
        setPreview(data.parsed || null)
        return
      }
      setPreview({ ...data.parsed, type: data.watch_type, inventory_matched: data.inventory_matched })
      setImportedWatchId(data.watch?.id ?? null)
      setSuccess(true)
      onImported()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-xl shadow-2xl my-4">
        <div className="flex items-center justify-between px-6 py-5 border-b-2 border-slate-100 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-t-3xl">
          <div>
            <h2 className="text-xl font-black text-white">📋 Paste WhatsApp Message</h2>
            <p className="text-emerald-100 text-xs mt-0.5">Parses buy/sell and enriches from inventory CSV</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white text-xl leading-none flex items-center justify-center font-bold">&times;</button>
        </div>

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto flex flex-col gap-4">
          {!success && (
            <>
              <div>
                <label className="text-xs text-slate-600 block mb-1.5 font-bold uppercase tracking-wide">Message Text</label>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={9}
                  placeholder={`Paste the full WhatsApp message here…`}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-emerald-400 resize-none font-mono" />
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1.5 font-bold uppercase tracking-wide">Image URL <span className="text-slate-400 normal-case font-medium">(optional)</span></label>
                <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..."
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
            </>
          )}

          {error && <div className="px-4 py-3 bg-red-50 border-2 border-red-200 rounded-xl text-sm text-red-700 font-medium">✗ {error}</div>}
          {skipped && (
            <div className="px-4 py-3 bg-amber-50 border-2 border-amber-200 rounded-xl text-sm text-amber-800">
              <p className="font-bold mb-1">⚠ Not imported</p>
              <p className="text-xs">{skipped === 'not_a_transaction' ? 'Message looks like chatter — include seller/sold-to, price, or reference.' : `Skipped: ${skipped}`}</p>
            </div>
          )}
          {success && preview && (
            <div className="px-4 py-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl text-sm text-emerald-800">
              <p className="font-bold mb-2">
                ✓ Imported as {preview.type === 'SELL' ? '🏷️ Sell' : '🛒 Buy'}
                {preview.inventory_matched && <span className="ml-2 font-semibold">· CSV matched</span>}
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-4">
                {preview.brand && <span><b>Brand:</b> {preview.brand}</span>}
                {preview.model && <span><b>Model:</b> {preview.model}</span>}
                {preview.ref_no && <span><b>Ref:</b> {preview.ref_no}</span>}
                {preview.stock_no && <span><b>Stock:</b> {preview.stock_no}</span>}
                {preview.bought_from && <span><b>Seller:</b> {preview.bought_from}</span>}
                {preview.sold_to && <span><b>Sold to:</b> {preview.sold_to}</span>}
                {preview.price != null && <span><b>Price:</b> {preview.price} {preview.currency}</span>}
              </div>
              <div className="flex gap-2">
                {importedWatchId && onViewWatch && (
                  <button onClick={() => { onViewWatch(importedWatchId); onClose() }}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm">View on pipeline</button>
                )}
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border-2 border-emerald-300 text-emerald-800 font-bold text-sm">Close</button>
              </div>
            </div>
          )}
        </div>

        {!success && (
          <div className="flex gap-3 px-6 py-5 border-t-2 border-slate-100">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-500 font-bold">Cancel</button>
            <button onClick={handleImport} disabled={loading || (!text.trim() && !imageUrl)}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black disabled:opacity-50">
              {loading ? 'Parsing…' : '📋 Parse & Import'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
