'use client'

import { useState } from 'react'

const BRANDS = [
  'Rolex',
  'Audemars Piguet',
  'Patek Philippe',
  'Tudor',
  'Cartier',
  'Richard Mille',
]

const CURRENCIES = ['USD', 'GBP', 'EUR', 'HKD', 'AED']

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', HKD: 'HK$', AED: 'AED',
}

interface FormData {
  // Identity
  brand: string
  model: string
  ref_no: string
  serial_no: string
  watch_date: string
  // Purchase
  bought_from: string
  currency: string
  purchase_price: string
  convert_rate: string
  // Details
  case_material: string
  dial_colour: string
  bracelet: string
  // Status
  stock_status: 'STOCK' | 'INCOMING'
  origin: string
  // Listing
  image_url: string
  website_price: string
  b2b_price: string
}

const empty: FormData = {
  brand: '', model: '', ref_no: '', serial_no: '', watch_date: '',
  bought_from: '', currency: 'USD', purchase_price: '', convert_rate: '',
  case_material: '', dial_colour: '', bracelet: '',
  stock_status: 'STOCK', origin: '',
  image_url: '', website_price: '', b2b_price: '',
}

interface Props {
  onClose: () => void
  onAdded: () => void
}

export default function AddWatchModal({ onClose, onAdded }: Props) {
  const [form, setForm] = useState<FormData>(empty)
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')
  const [aiMsg, setAiMsg] = useState('')

  const set = (key: keyof FormData, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }))

  // Purchase price in USD (computed)
  const purchasePriceUSD = (() => {
    const p = parseFloat(form.purchase_price)
    const r = parseFloat(form.convert_rate)
    if (!p) return null
    if (form.currency === 'USD') return p
    if (r) return +(p * r).toFixed(2)
    return null
  })()

  const handleAIFill = async () => {
    if (!form.brand) { setAiMsg('Select a brand first.'); return }
    setAiLoading(true); setAiMsg('')
    try {
      const res = await fetch('/api/ai/watch-autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: form.brand, ref_no: form.ref_no, model: form.model }),
      })
      const data = await res.json()
      setForm(prev => ({
        ...prev,
        model: data.model || prev.model,
        case_material: data.case_material || prev.case_material,
        dial_colour: data.dial_colour || prev.dial_colour,
        bracelet: data.bracelet || prev.bracelet,
      }))
      setAiMsg('✓ AI suggestions applied')
      setTimeout(() => setAiMsg(''), 3000)
    } catch {
      setAiMsg('AI unavailable — fill manually')
    } finally {
      setAiLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')

    if (!form.website_price || !form.b2b_price) {
      setError('Website price and B2B price are required.')
      return
    }
    if (form.currency !== 'USD' && !form.convert_rate) {
      setError(`Enter the ${form.currency} to USD conversion rate.`)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
          convert_rate: form.convert_rate ? parseFloat(form.convert_rate) : null,
          website_price: parseFloat(form.website_price),
          b2b_price: parseFloat(form.b2b_price),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      onAdded(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add watch')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors'
  const labelCls = 'text-xs text-slate-400 block mb-1 font-medium'
  const sectionCls = 'border-t border-white/8 pt-4 mt-4'

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#16161f] rounded-2xl border border-white/10 w-full max-w-2xl shadow-2xl my-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Add Watch</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none transition-colors">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-0">

          {/* ── WATCH IDENTITY ── */}
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Watch Identity</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Brand</label>
                <select value={form.brand} onChange={e => set('brand', e.target.value)}
                  className={inputCls}>
                  <option value="">Select brand...</option>
                  {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Model</label>
                <input type="text" value={form.model} onChange={e => set('model', e.target.value)}
                  placeholder="e.g. Submariner Date" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Reference No.</label>
                <input type="text" value={form.ref_no} onChange={e => set('ref_no', e.target.value)}
                  placeholder="e.g. 126610LN" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Serial No.</label>
                <input type="text" value={form.serial_no} onChange={e => set('serial_no', e.target.value)}
                  placeholder="e.g. 5X123456" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Watch Date / Year</label>
                <input type="text" value={form.watch_date} onChange={e => set('watch_date', e.target.value)}
                  placeholder="e.g. 2023" className={inputCls} />
              </div>
            </div>
          </div>

          {/* ── PURCHASE INFO ── */}
          <div className={sectionCls}>
            <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Purchase</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Bought From</label>
                <input type="text" value={form.bought_from} onChange={e => set('bought_from', e.target.value)}
                  placeholder="Dealer name / person" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Currency</label>
                <div className="flex gap-2">
                  {CURRENCIES.map(c => (
                    <button key={c} type="button"
                      onClick={() => { set('currency', c); if (c === 'USD') set('convert_rate', '') }}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                        form.currency === c
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-white/10 text-slate-500 hover:text-white hover:border-white/30'
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  Purchase Price ({CURRENCY_SYMBOLS[form.currency] || form.currency})
                </label>
                <input type="number" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)}
                  placeholder="0.00" min="0" step="0.01" className={inputCls} />
              </div>

              {form.currency !== 'USD' && (
                <>
                  <div>
                    <label className={labelCls}>
                      Rate: 1 {form.currency} = ? USD
                    </label>
                    <input type="number" value={form.convert_rate} onChange={e => set('convert_rate', e.target.value)}
                      placeholder="e.g. 1.27" min="0" step="0.000001" className={inputCls} />
                  </div>
                  {purchasePriceUSD !== null && (
                    <div className="flex items-end pb-1">
                      <span className="text-green-400 text-sm font-semibold">
                        ≈ ${purchasePriceUSD.toLocaleString()} USD
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── WATCH DETAILS (AI) ── */}
          <div className={sectionCls}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Watch Details</p>
              <div className="flex items-center gap-2">
                {aiMsg && (
                  <span className={`text-xs ${aiMsg.startsWith('✓') ? 'text-green-400' : 'text-amber-400'}`}>
                    {aiMsg}
                  </span>
                )}
                <button type="button" onClick={handleAIFill} disabled={aiLoading || !form.brand}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-300 text-xs font-semibold transition-all disabled:opacity-40">
                  {aiLoading ? (
                    <span className="animate-spin text-base leading-none">⟳</span>
                  ) : (
                    <span>✨</span>
                  )}
                  {aiLoading ? 'Thinking...' : 'AI Autofill'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Case Material</label>
                <input type="text" value={form.case_material} onChange={e => set('case_material', e.target.value)}
                  placeholder="e.g. Oystersteel" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Dial Colour</label>
                <input type="text" value={form.dial_colour} onChange={e => set('dial_colour', e.target.value)}
                  placeholder="e.g. Black" className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Bracelet / Strap</label>
                <input type="text" value={form.bracelet} onChange={e => set('bracelet', e.target.value)}
                  placeholder="e.g. Oyster Bracelet" className={inputCls} />
              </div>
            </div>
          </div>

          {/* ── STATUS & ORIGIN ── */}
          <div className={sectionCls}>
            <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Status & Origin</p>
            <div className="grid grid-cols-2 gap-3 items-start">
              <div>
                <label className={labelCls}>Stock Status</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => set('stock_status', 'STOCK')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      form.stock_status === 'STOCK'
                        ? 'bg-green-600/20 border-green-500/50 text-green-400'
                        : 'border-white/10 text-slate-500 hover:text-slate-300'
                    }`}>
                    ✓ In Stock
                  </button>
                  <button type="button" onClick={() => set('stock_status', 'INCOMING')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      form.stock_status === 'INCOMING'
                        ? 'bg-amber-600/20 border-amber-500/50 text-amber-400'
                        : 'border-white/10 text-slate-500 hover:text-slate-300'
                    }`}>
                    ⏳ Incoming
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Origin <span className="text-slate-600">(optional)</span></label>
                <input type="text" value={form.origin} onChange={e => set('origin', e.target.value)}
                  placeholder="e.g. UK, Japan, Switzerland" className={inputCls} />
              </div>
            </div>
          </div>

          {/* ── LISTING ── */}
          <div className={sectionCls}>
            <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Listing & Pricing</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Image URL</label>
                <input type="url" value={form.image_url} onChange={e => set('image_url', e.target.value)}
                  placeholder="https://..." className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Website Price (USD) *</label>
                <input type="number" value={form.website_price} onChange={e => set('website_price', e.target.value)}
                  placeholder="0.00" min="0" step="0.01" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>B2B Price (USD) *</label>
                <input type="number" value={form.b2b_price} onChange={e => set('b2b_price', e.target.value)}
                  placeholder="0.00" min="0" step="0.01" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="mt-3 text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-5 border-t border-white/8 mt-5">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors font-medium">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-50">
              {loading ? 'Adding...' : 'Add Watch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
