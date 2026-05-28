'use client'

import { useState, useEffect, useCallback } from 'react'

type WatchStage = 'LOGISTICS' | 'ACCOUNTING' | 'SALES'
type PaymentStatus = 'NOT_PAID' | 'PARTIAL' | 'PAID'
type LocationStatus = 'INCOMING' | 'IN_TRANSIT' | 'IN_STOCK'
type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'CRYPTO'

const BRANDS = ['Rolex', 'Audemars Piguet', 'Patek Philippe', 'Tudor', 'Cartier', 'Richard Mille']
const CURRENCIES = ['USD', 'GBP', 'EUR', 'HKD', 'AED']
const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', HKD: 'HK$', AED: 'AED' }

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  CRYPTO: 'Crypto',
}

export interface WatchDetail {
  id: number
  name: string
  brand: string | null
  model: string | null
  ref_no: string | null
  serial_no: string | null
  stock_no: string | null
  watch_date: string | null
  bought_from: string | null
  currency: string
  purchase_price: string | number | null
  convert_rate: string | number | null
  case_material: string | null
  dial_colour: string | null
  bracelet: string | null
  stock_status: string
  origin: string | null
  image_url: string | null
  website_price: string | number
  b2b_price: string | number
  stage: WatchStage
  is_sold: boolean
  payment_status: PaymentStatus
  total_amount: number | null
  location_status: LocationStatus
  location_from: string | null
  location_to: string | null
  transit_pickup_date: string | null
  transit_carrier: string | null
  transit_tracking_number: string | null
  received_date: string | null
}

interface WatchPayment {
  id: number
  amount: number
  currency: string
  payment_method: PaymentMethod
  payment_date: string
  notes: string | null
}

interface Props {
  watch: WatchDetail
  onClose: () => void
  onUpdated: () => void
}

type Tab = 'details' | 'payment' | 'location'

export default function WatchDetailModal({ watch: initialWatch, onClose, onUpdated }: Props) {
  const [tab, setTab] = useState<Tab>('details')
  const [watch, setWatch] = useState<WatchDetail>(initialWatch)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [stockLookupLoading, setStockLookupLoading] = useState(false)

  // Payment tab
  const [payments, setPayments] = useState<WatchPayment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [newPayment, setNewPayment] = useState({
    amount: '', currency: 'USD', payment_method: 'CASH' as PaymentMethod,
    payment_date: new Date().toISOString().split('T')[0], notes: '',
  })
  const [addingPayment, setAddingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  const fetchPayments = useCallback(async () => {
    setLoadingPayments(true)
    try {
      const res = await fetch(`/api/watches/${watch.id}/payments`)
      if (res.ok) setPayments(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoadingPayments(false) }
  }, [watch.id])

  useEffect(() => {
    if (tab === 'payment') fetchPayments()
  }, [tab, fetchPayments])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setW = (key: keyof WatchDetail, val: any) => setWatch(prev => ({ ...prev, [key]: val }))

  const flashMsg = (msg: string) => {
    setSaveMsg(msg)
    setTimeout(() => setSaveMsg(''), 2500)
  }

  const matchBrand = (raw: string | null | undefined) => {
    if (!raw) return null
    const hit = BRANDS.find(b => b.toLowerCase() === raw.toLowerCase())
    return hit || raw
  }

  const lookupStockFromInventory = async (stockNo: string) => {
    const trimmed = stockNo.replace(/^#/, '').trim()
    if (!/^\d+$/.test(trimmed)) return
    setStockLookupLoading(true)
    try {
      const res = await fetch(`/api/inventory/lookup?stock_no=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (!data.found) {
        flashMsg('No inventory match for this stock #')
        return
      }
      setWatch(prev => ({
        ...prev,
        brand: prev.brand || matchBrand(data.brand),
        model: prev.model || data.model || null,
        ref_no: prev.ref_no || data.ref_no || null,
        serial_no: prev.serial_no || data.serial_no || null,
        watch_date: prev.watch_date || (data.watch_date ? String(data.watch_date) : null),
        bought_from: prev.bought_from || data.bought_from || null,
        image_url: prev.image_url || data.image_url || null,
        currency: prev.currency || data.currency || prev.currency,
        purchase_price: prev.purchase_price || data.purchase_price || null,
        website_price: prev.website_price || data.website_price || data.sold_price || prev.website_price,
        location_to: prev.location_to || data.category || null,
        payment_status: prev.payment_status || data.payment_status || prev.payment_status,
      }))
      flashMsg('✓ Filled from inventory CSV')
    } catch {
      flashMsg('Inventory lookup failed')
    } finally {
      setStockLookupLoading(false)
    }
  }

  const saveDetails = async () => {
    setSaving(true); setSaveMsg('')
    try {
      const res = await fetch(`/api/watches/${watch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: watch.brand, model: watch.model, ref_no: watch.ref_no,
          serial_no: watch.serial_no, stock_no: watch.stock_no, watch_date: watch.watch_date,
          bought_from: watch.bought_from, currency: watch.currency,
          purchase_price: watch.purchase_price, convert_rate: watch.convert_rate,
          case_material: watch.case_material, dial_colour: watch.dial_colour,
          bracelet: watch.bracelet, stock_status: watch.stock_status,
          origin: watch.origin, image_url: watch.image_url,
          website_price: watch.website_price, b2b_price: watch.b2b_price,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      flashMsg('✓ Saved!')
      onUpdated()
    } catch { flashMsg('Error saving') }
    finally { setSaving(false) }
  }

  const savePaymentStatus = async (status: PaymentStatus) => {
    setW('payment_status', status)
    try {
      await fetch(`/api/watches/${watch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: status }),
      })
      onUpdated()
    } catch { console.error('Failed to update payment status') }
  }

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault(); setPaymentError('')
    if (!newPayment.amount || isNaN(parseFloat(newPayment.amount))) {
      setPaymentError('Enter a valid amount.'); return
    }
    setAddingPayment(true)
    try {
      const res = await fetch(`/api/watches/${watch.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newPayment, amount: parseFloat(newPayment.amount) }),
      })
      if (!res.ok) throw new Error('Failed')
      setNewPayment({ amount: '', currency: 'USD', payment_method: 'CASH', payment_date: new Date().toISOString().split('T')[0], notes: '' })
      fetchPayments()
    } catch { setPaymentError('Failed to add payment') }
    finally { setAddingPayment(false) }
  }

  const saveLocation = async () => {
    setSaving(true); setSaveMsg('')
    try {
      const res = await fetch(`/api/watches/${watch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_status: watch.location_status,
          location_from: watch.location_from,
          location_to: watch.location_to,
          transit_pickup_date: watch.transit_pickup_date,
          transit_carrier: watch.transit_carrier,
          transit_tracking_number: watch.transit_tracking_number,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      flashMsg('✓ Saved!')
      onUpdated()
    } catch { flashMsg('Error saving') }
    finally { setSaving(false) }
  }

  const inputCls = 'w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all'
  const labelCls = 'text-xs text-slate-600 block mb-1.5 font-bold uppercase tracking-wide'

  const TABS: { id: Tab; label: string }[] = [
    { id: 'details', label: '📋 Details' },
    { id: 'payment', label: '💳 Payment' },
    { id: 'location', label: '📦 Location' },
  ]

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-2xl shadow-2xl my-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-slate-800 to-slate-900 rounded-t-3xl">
          <div>
            <h2 className="text-xl font-black text-white">
              {watch.brand ? `${watch.brand} ` : ''}{watch.model || watch.name}
            </h2>
            {(watch.ref_no || watch.stock_no) && (
              <p className="text-slate-400 text-xs mt-0.5">
                {watch.ref_no && <>Ref. {watch.ref_no}</>}
                {watch.ref_no && watch.stock_no && <span className="text-slate-300"> · </span>}
                {watch.stock_no && <span className="text-slate-700 font-bold">#{watch.stock_no}</span>}
              </p>
            )}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 text-white text-xl leading-none flex items-center justify-center transition-colors font-bold">
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 pt-4 bg-white">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`mr-6 pb-3 text-sm font-bold border-b-2 transition-all ${
                tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">

          {/* ─── DETAILS TAB ─── */}
          {tab === 'details' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Brand</label>
                <select value={watch.brand || ''} onChange={e => setW('brand', e.target.value || null)} className={inputCls}>
                  <option value="">Select brand...</option>
                  {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Model</label>
                <input type="text" value={watch.model || ''} onChange={e => setW('model', e.target.value || null)} placeholder="Model name" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Reference No.</label>
                <input type="text" value={watch.ref_no || ''} onChange={e => setW('ref_no', e.target.value || null)} placeholder="e.g. 126610LN" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Serial No.</label>
                <input type="text" value={watch.serial_no || ''} onChange={e => setW('serial_no', e.target.value || null)} placeholder="e.g. 5X123456" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Stock No.</label>
                <input
                  type="text"
                  value={watch.stock_no || ''}
                  onChange={e => setW('stock_no', e.target.value || null)}
                  onBlur={e => lookupStockFromInventory(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') lookupStockFromInventory(watch.stock_no || '') }}
                  placeholder="e.g. 1377"
                  className={inputCls}
                />
                {stockLookupLoading && <p className="text-xs text-slate-400 mt-1">Looking up inventory…</p>}
              </div>
              <div>
                <label className={labelCls}>Watch Date / Year</label>
                <input type="text" value={watch.watch_date || ''} onChange={e => setW('watch_date', e.target.value || null)} placeholder="e.g. 2023" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Bought From</label>
                <input type="text" value={watch.bought_from || ''} onChange={e => setW('bought_from', e.target.value || null)} placeholder="Dealer name" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Currency</label>
                <div className="flex gap-1">
                  {CURRENCIES.map(c => (
                    <button key={c} type="button" onClick={() => setW('currency', c)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        watch.currency === c ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-400 hover:text-slate-700 bg-white'
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Purchase Price ({CURRENCY_SYMBOLS[watch.currency] || watch.currency})</label>
                <input type="number" value={watch.purchase_price ?? ''} onChange={e => setW('purchase_price', e.target.value || null)} placeholder="0.00" min="0" step="0.01" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Case Material</label>
                <input type="text" value={watch.case_material || ''} onChange={e => setW('case_material', e.target.value || null)} placeholder="e.g. Oystersteel" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Dial Colour</label>
                <input type="text" value={watch.dial_colour || ''} onChange={e => setW('dial_colour', e.target.value || null)} placeholder="e.g. Black" className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Bracelet / Strap</label>
                <input type="text" value={watch.bracelet || ''} onChange={e => setW('bracelet', e.target.value || null)} placeholder="e.g. Oyster Bracelet" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Origin</label>
                <input type="text" value={watch.origin || ''} onChange={e => setW('origin', e.target.value || null)} placeholder="e.g. UK, Japan" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Website Price (USD)</label>
                <input type="number" value={watch.website_price} onChange={e => setW('website_price', e.target.value)} placeholder="0.00" min="0" step="0.01" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>B2B Price (USD)</label>
                <input type="number" value={watch.b2b_price} onChange={e => setW('b2b_price', e.target.value)} placeholder="0.00" min="0" step="0.01" className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Image URL</label>
                <input type="url" value={watch.image_url || ''} onChange={e => setW('image_url', e.target.value || null)} placeholder="https://..." className={inputCls} />
              </div>
            </div>
          )}

          {/* ─── PAYMENT TAB ─── */}
          {tab === 'payment' && (
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-600 font-black mb-4">Payment Status</p>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {([
                  { val: 'NOT_PAID' as PaymentStatus, icon: '✗', label: 'Not Paid', activeBg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700' },
                  { val: 'PARTIAL' as PaymentStatus, icon: '⏳', label: 'Partial', activeBg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700' },
                  { val: 'PAID' as PaymentStatus, icon: '✓', label: 'Paid', activeBg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700' },
                ] as const).map(opt => (
                  <button key={opt.val} type="button"
                    onClick={() => savePaymentStatus(opt.val)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      watch.payment_status === opt.val
                        ? `${opt.activeBg} ${opt.border} shadow-sm`
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}>
                    <div className={`text-xl mb-1 ${watch.payment_status === opt.val ? opt.text : 'text-slate-300'}`}>{opt.icon}</div>
                    <div className={`text-sm font-black ${watch.payment_status === opt.val ? opt.text : 'text-slate-500'}`}>{opt.label}</div>
                  </button>
                ))}
              </div>

              {/* History */}
              <div className="mb-5">
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">Payment History</p>
                {loadingPayments ? (
                  <div className="text-center text-slate-400 py-4 text-sm">Loading...</div>
                ) : payments.length === 0 ? (
                  <div className="text-center text-slate-400 py-4 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                    No payments recorded yet
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                          <th className="text-left px-4 py-2.5 font-semibold">Date</th>
                          <th className="text-left px-4 py-2.5 font-semibold">Amount</th>
                          <th className="text-left px-4 py-2.5 font-semibold">Method</th>
                          <th className="text-left px-4 py-2.5 font-semibold">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payments.map(p => (
                          <tr key={p.id} className="bg-white hover:bg-slate-50">
                            <td className="px-4 py-2.5 text-slate-500">{new Date(p.payment_date).toLocaleDateString()}</td>
                            <td className="px-4 py-2.5 text-slate-900 font-semibold">{p.currency} {p.amount.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-slate-500">{PAYMENT_METHOD_LABELS[p.payment_method]}</td>
                            <td className="px-4 py-2.5 text-slate-400 truncate max-w-[120px]">{p.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Add payment */}
              <form onSubmit={addPayment} className="border-2 border-slate-100 rounded-2xl p-4">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Add Payment Record</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Amount</label>
                    <input type="number" value={newPayment.amount} onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" min="0" step="0.01" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Currency</label>
                    <select value={newPayment.currency} onChange={e => setNewPayment(p => ({ ...p, currency: e.target.value }))} className={inputCls}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Method</label>
                    <select value={newPayment.payment_method} onChange={e => setNewPayment(p => ({ ...p, payment_method: e.target.value as PaymentMethod }))} className={inputCls}>
                      <option value="CASH">Cash</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="CRYPTO">Crypto</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Date</label>
                    <input type="date" value={newPayment.payment_date} onChange={e => setNewPayment(p => ({ ...p, payment_date: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Notes <span className="text-slate-300">(optional)</span></label>
                    <input type="text" value={newPayment.notes} onChange={e => setNewPayment(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Wire transfer ref #1234" className={inputCls} />
                  </div>
                </div>
                {paymentError && (
                  <p className="text-red-600 text-sm mt-2 bg-red-50 rounded-lg px-3 py-2 border border-red-100">{paymentError}</p>
                )}
                <button type="submit" disabled={addingPayment}
                  className="mt-3 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors disabled:opacity-50">
                  {addingPayment ? 'Adding...' : '+ Add Payment'}
                </button>
              </form>
            </div>
          )}

          {/* ─── LOCATION TAB ─── */}
          {tab === 'location' && (
            <div>
              <p className="text-xs uppercase tracking-widest text-blue-600 font-black mb-4">Watch Location</p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className={labelCls}>From</label>
                  <input type="text" value={watch.location_from || ''} onChange={e => setW('location_from', e.target.value || null)} placeholder="e.g. Tokyo, Japan" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>To</label>
                  <input type="text" value={watch.location_to || ''} onChange={e => setW('location_to', e.target.value || null)} placeholder="e.g. London, UK" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {([
                  { val: 'INCOMING' as LocationStatus, icon: '📬', label: 'Incoming', desc: 'Awaiting dispatch', bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-700' },
                  { val: 'IN_TRANSIT' as LocationStatus, icon: '🚚', label: 'In Transit', desc: 'Being shipped', bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' },
                  { val: 'IN_STOCK' as LocationStatus, icon: '✅', label: 'In Stock', desc: 'Arrived & received', bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700' },
                ] as const).map(opt => (
                  <button key={opt.val} type="button"
                    onClick={() => setW('location_status', opt.val)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      watch.location_status === opt.val
                        ? `${opt.bg} ${opt.border} shadow-sm`
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}>
                    <div className={`text-2xl mb-2 ${watch.location_status !== opt.val ? 'opacity-30' : ''}`}>{opt.icon}</div>
                    <div className={`text-sm font-black ${watch.location_status === opt.val ? opt.text : 'text-slate-500'}`}>{opt.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>

              {watch.location_status === 'IN_TRANSIT' && (
                <div className="border-2 border-blue-100 rounded-2xl p-4 bg-blue-50/40">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3">🚚 Transit Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Pickup Date</label>
                      <input type="date"
                        value={watch.transit_pickup_date ? watch.transit_pickup_date.split('T')[0] : ''}
                        onChange={e => setW('transit_pickup_date', e.target.value || null)}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Carrier</label>
                      <input type="text" value={watch.transit_carrier || ''} onChange={e => setW('transit_carrier', e.target.value || null)} placeholder="e.g. DHL, FedEx" className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Tracking Number <span className="text-slate-300">(optional)</span></label>
                      <input type="text" value={watch.transit_tracking_number || ''} onChange={e => setW('transit_tracking_number', e.target.value || null)} placeholder="e.g. 1Z999AA10123456784" className={inputCls} />
                    </div>
                  </div>
                </div>
              )}

              {watch.received_date && (
                <div className="mt-3 flex items-center gap-2 text-emerald-700 text-sm bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-200">
                  <span>✅</span>
                  <span>Received on {new Date(watch.received_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t-2 border-slate-100">
          {saveMsg && (
            <span className={`text-sm font-medium ${saveMsg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
              {saveMsg}
            </span>
          )}
          <div className="flex-1" />
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-500 hover:text-slate-900 font-bold text-sm transition-all">
            Close
          </button>
          {(tab === 'details' || tab === 'location') && (
            <button onClick={tab === 'details' ? saveDetails : saveLocation} disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
