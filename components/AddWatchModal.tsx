'use client'

import { useState, useEffect } from 'react'

const BRANDS = ['Rolex', 'Audemars Piguet', 'Patek Philippe', 'Tudor', 'Cartier', 'Richard Mille']
const CURRENCIES = ['USD', 'GBP', 'EUR', 'HKD', 'AED']
const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', HKD: 'HK$', AED: 'AED' }

type PaymentStatus = 'NOT_PAID' | 'PARTIAL' | 'PAID'
type LocationStatus = 'INCOMING' | 'IN_TRANSIT' | 'IN_STOCK'
type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'CRYPTO'

interface WatchForm {
  brand: string; model: string; ref_no: string; serial_no: string; stock_no: string; watch_date: string
  bought_from: string; sold_to: string
  currency: string; purchase_price: string; convert_rate: string
  case_material: string; dial_colour: string; bracelet: string
  stock_status: 'STOCK' | 'INCOMING'; origin: string; image_url: string
  website_price: string; b2b_price: string
  watch_type: 'BUY' | 'SELL'
}

interface PaymentForm {
  payment_status: PaymentStatus
  add_payment_record: boolean
  amount: string; pay_currency: string; payment_method: PaymentMethod
  payment_date: string; notes: string
}

interface LocationForm {
  location_status: LocationStatus
  location_from: string; location_to: string
  transit_pickup_date: string; transit_carrier: string; transit_tracking_number: string
}

const emptyWatch: WatchForm = {
  brand: '', model: '', ref_no: '', serial_no: '', stock_no: '', watch_date: '',
  bought_from: '', sold_to: '',
  currency: 'USD', purchase_price: '', convert_rate: '',
  case_material: '', dial_colour: '', bracelet: '',
  stock_status: 'STOCK', origin: '', image_url: '',
  website_price: '', b2b_price: '',
  watch_type: 'BUY',
}

const emptyPayment: PaymentForm = {
  payment_status: 'NOT_PAID',
  add_payment_record: false,
  amount: '', pay_currency: 'USD', payment_method: 'CASH',
  payment_date: new Date().toISOString().split('T')[0], notes: '',
}

const emptyLocation: LocationForm = {
  location_status: 'INCOMING',
  location_from: '', location_to: '',
  transit_pickup_date: '', transit_carrier: '', transit_tracking_number: '',
}

interface Props { onClose: () => void; onAdded: () => void; initialStockNo?: string }

const BUY_STEPS = ['Identity', 'Deal', 'Payment & Location']
const SELL_STEPS = ['Identity', 'Deal', 'Payment']

export default function AddWatchModal({ onClose, onAdded, initialStockNo = '' }: Props) {
  const [step, setStep] = useState(1)
  const [watch, setWatch] = useState<WatchForm>({ ...emptyWatch, stock_no: initialStockNo })
  const [payment, setPayment] = useState<PaymentForm>(emptyPayment)
  const [location, setLocation] = useState<LocationForm>(emptyLocation)
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [stockLookupLoading, setStockLookupLoading] = useState(false)
  const [error, setError] = useState('')
  const [aiMsg, setAiMsg] = useState('')
  const [inventoryMsg, setInventoryMsg] = useState('')
  const [showMoreDetails, setShowMoreDetails] = useState(false)

  useEffect(() => {
    if (initialStockNo) lookupStockFromInventory(initialStockNo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setW = (key: keyof WatchForm, val: string) => setWatch(prev => ({ ...prev, [key]: val }))
  const setP = (key: keyof PaymentForm, val: string | boolean) => setPayment(prev => ({ ...prev, [key]: val }))
  const setL = (key: keyof LocationForm, val: string) => setLocation(prev => ({ ...prev, [key]: val }))

  const isSell = watch.watch_type === 'SELL'
  const STEPS = isSell ? SELL_STEPS : BUY_STEPS
  const totalSteps = STEPS.length

  const purchasePriceUSD = (() => {
    const p = parseFloat(watch.purchase_price)
    const r = parseFloat(watch.convert_rate)
    if (!p) return null
    if (watch.currency === 'USD') return p
    if (r) return +(p * r).toFixed(2)
    return null
  })()

  const matchBrand = (raw: string | null | undefined) => {
    if (!raw) return ''
    const hit = BRANDS.find(b => b.toLowerCase() === raw.toLowerCase())
    return hit || raw
  }

  const lookupStockFromInventory = async (stockNo: string) => {
    const trimmed = stockNo.replace(/^#/, '').trim()
    if (!/^\d+$/.test(trimmed)) return
    setStockLookupLoading(true)
    setInventoryMsg('')
    try {
      const res = await fetch(`/api/inventory/lookup?stock_no=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (!data.found) {
        setInventoryMsg('No match in inventory CSV')
        setTimeout(() => setInventoryMsg(''), 3000)
        return
      }
      setWatch(prev => ({
        ...prev,
        brand: prev.brand || matchBrand(data.brand),
        model: prev.model || data.model || '',
        ref_no: prev.ref_no || data.ref_no || '',
        serial_no: prev.serial_no || data.serial_no || '',
        watch_date: prev.watch_date || (data.watch_date ? String(data.watch_date) : ''),
        bought_from: prev.bought_from || data.bought_from || '',
        sold_to: prev.sold_to || data.sold_to || '',
        image_url: prev.image_url || data.image_url || '',
        currency: data.purchase_price && !prev.purchase_price ? (data.currency || 'GBP') : prev.currency,
        purchase_price: prev.purchase_price || (data.purchase_price ? String(data.purchase_price) : ''),
        website_price: prev.website_price || (
          isSell && data.sold_price ? String(data.sold_price)
            : data.website_price ? String(data.website_price) : ''
        ),
      }))
      if (data.payment_status) {
        setP('payment_status', data.payment_status)
      }
      if (data.category) {
        setL('location_to', location.location_to || data.category)
      }
      setInventoryMsg('✓ Filled from inventory CSV')
      setTimeout(() => setInventoryMsg(''), 3000)
    } catch {
      setInventoryMsg('Inventory lookup failed')
    } finally {
      setStockLookupLoading(false)
    }
  }

  const handleAIFill = async () => {
    if (!watch.brand) { setAiMsg('Select a brand first.'); return }
    setAiLoading(true); setAiMsg('')
    try {
      const res = await fetch('/api/ai/watch-autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: watch.brand, ref_no: watch.ref_no, model: watch.model }),
      })
      const data = await res.json()
      setWatch(prev => ({
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

  const validateStep2 = () => {
    if (!isSell && watch.currency !== 'USD' && !watch.convert_rate) {
      setError(`Enter the ${watch.currency} to USD conversion rate.`)
      return false
    }
    setError('')
    return true
  }

  const handleNext = () => {
    if (step === 2 && !validateStep2()) return
    setError('')
    setStep(s => s + 1)
  }

  const handleBack = () => {
    setError('')
    setStep(s => s - 1)
  }

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      // For Sell watches, location/stock are irrelevant — submit them as nulls/in-stock placeholder
      const locationPayload = isSell
        ? {
            location_status: 'IN_STOCK',
            location_from: null,
            location_to: null,
            transit_pickup_date: null,
            transit_carrier: null,
            transit_tracking_number: null,
          }
        : {
            location_status: location.location_status,
            location_from: location.location_from || null,
            location_to: location.location_to || null,
            transit_pickup_date: location.transit_pickup_date || null,
            transit_carrier: location.transit_carrier || null,
            transit_tracking_number: location.transit_tracking_number || null,
          }
      const res = await fetch('/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...watch,
          watch_type: watch.watch_type,
          // Sell watches don't track stock_status — force STOCK as a no-op default
          stock_status: isSell ? 'STOCK' : watch.stock_status,
          stock_no: watch.stock_no || null,
          sold_to: isSell ? (watch.sold_to || null) : null,
          bought_from: isSell ? null : (watch.bought_from || null),
          purchase_price: watch.purchase_price ? parseFloat(watch.purchase_price) : null,
          convert_rate: watch.convert_rate ? parseFloat(watch.convert_rate) : null,
          website_price: watch.website_price ? parseFloat(watch.website_price) : 0,
          b2b_price: watch.b2b_price ? parseFloat(watch.b2b_price) : 0,
          payment_status: payment.payment_status,
          ...locationPayload,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const newWatch = await res.json()

      // Optionally create a payment record
      if (payment.add_payment_record && payment.amount && payment.payment_status !== 'NOT_PAID') {
        await fetch(`/api/watches/${newWatch.id}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseFloat(payment.amount),
            currency: payment.pay_currency,
            payment_method: payment.payment_method,
            payment_date: payment.payment_date,
            notes: payment.notes || null,
          }),
        })
      }

      onAdded(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add watch')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'input-field rounded-2xl'
  const labelCls = 'section-label block mb-1.5'
  const sectionCls = 'border-t border-default pt-5 mt-5'
  const chipCls = (active: boolean) =>
    active ? 'chip-active flex-1 text-center py-2' : 'chip flex-1 text-center py-2 hover:border-accent/40 hover:text-ink'

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="card w-full max-w-2xl shadow-none my-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-default bg-card rounded-t-3xl">
          <div>
            <h2 className="font-display text-xl font-bold text-ink tracking-wide">Add Watch</h2>
            <p className="text-muted text-xs mt-0.5">Step {step} of {totalSteps} — {STEPS[step - 1]}</p>
          </div>
          <button onClick={onClose} className="btn-ghost w-8 h-8 p-0 rounded-full text-lg leading-none">&times;</button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center">
            {STEPS.map((label, i) => {
              const s = i + 1
              const active = step === s
              const done = step > s
              return (
                <div key={s} className="flex items-center flex-1 last:flex-none">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      done || active ? 'bg-accent text-white' : 'bg-panel text-muted'
                    } ${active ? 'ring-4 ring-accent/20' : ''}`}>
                      {done ? '✓' : s}
                    </div>
                    <span className={`text-xs font-semibold hidden sm:block whitespace-nowrap ${active ? 'text-accent' : done ? 'text-muted' : 'text-muted/60'}`}>
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-3 rounded-full ${done ? 'bg-accent/60' : 'bg-ink/10'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">

          {/* ─── STEP 1: WATCH DETAILS ─── */}
          {step === 1 && (
            <>
              {/* Stock first */}
              <div className="mb-5">
                <label className={labelCls}>Stock No. — start here</label>
                <input type="text" value={watch.stock_no} onChange={e => setW('stock_no', e.target.value)}
                  onBlur={e => lookupStockFromInventory(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') lookupStockFromInventory(watch.stock_no) }}
                  placeholder="e.g. 1377" className={inputCls} autoFocus={!!initialStockNo} />
                {(stockLookupLoading || inventoryMsg) && (
                  <p className={`text-xs mt-1 ${inventoryMsg.startsWith('✓') ? 'text-emerald-600' : 'text-muted'}`}>
                    {stockLookupLoading ? 'Looking up inventory…' : inventoryMsg}
                  </p>
                )}
              </div>

              {/* Watch Type */}
              <div className="mb-5">
                <p className="section-label mb-2">Watch Type</p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setW('watch_type', 'BUY') }}
                    className={chipCls(watch.watch_type === 'BUY')}>
                    🛒 Buy
                  </button>
                  <button type="button" onClick={() => { setW('watch_type', 'SELL'); if (step > SELL_STEPS.length) setStep(SELL_STEPS.length) }}
                    className={watch.watch_type === 'SELL' ? 'chip-active flex-1 text-center py-3' : 'chip flex-1 text-center py-3 hover:border-accent/40 hover:text-ink'}>
                    🏷️ Sell
                  </button>
                </div>
                {isSell && (
                  <p className="text-xs text-accent mt-2 font-medium">
                    🏷️ For Sell watches, stock & location fields are skipped — you already own the watch.
                  </p>
                )}
              </div>

              <div>
                <p className="section-label mb-3 flex items-center gap-2">
                  <span className="text-base">🕐</span> Watch Identity
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Brand</label>
                    <select value={watch.brand} onChange={e => setW('brand', e.target.value)} className={inputCls}>
                      <option value="">Select brand...</option>
                      {watch.brand && !BRANDS.includes(watch.brand) && (
                        <option value={watch.brand}>{watch.brand}</option>
                      )}
                      {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Model</label>
                    <input type="text" value={watch.model} onChange={e => setW('model', e.target.value)} placeholder="e.g. Submariner Date" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Reference No.</label>
                    <input type="text" value={watch.ref_no} onChange={e => setW('ref_no', e.target.value)} placeholder="e.g. 126610LN" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Serial No.</label>
                    <input type="text" value={watch.serial_no} onChange={e => setW('serial_no', e.target.value)} placeholder="e.g. 5X123456" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Watch Date / Year</label>
                    <input type="text" value={watch.watch_date} onChange={e => setW('watch_date', e.target.value)} placeholder="e.g. 2023" className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Image URL</label>
                    <input type="url" value={watch.image_url} onChange={e => setW('image_url', e.target.value)} placeholder="https://..." className={inputCls} />
                  </div>
                </div>
              </div>

              <div className={sectionCls}>
                <button type="button" onClick={() => setShowMoreDetails(v => !v)}
                  className="text-xs font-semibold text-accent uppercase tracking-wide">
                  {showMoreDetails ? '▾ Hide' : '▸'} More details (case, dial, bracelet)
                </button>
                {showMoreDetails && (
                  <div className="mt-3">
                    <div className="flex justify-end mb-2 gap-2">
                      {aiMsg && <span className={`text-xs ${aiMsg.startsWith('✓') ? 'text-green-600' : 'text-amber-600'}`}>{aiMsg}</span>}
                      <button type="button" onClick={handleAIFill} disabled={aiLoading || !watch.brand}
                        className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">
                        ✨ AI Autofill
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={labelCls}>Case Material</label><input type="text" value={watch.case_material} onChange={e => setW('case_material', e.target.value)} className={inputCls} /></div>
                      <div><label className={labelCls}>Dial Colour</label><input type="text" value={watch.dial_colour} onChange={e => setW('dial_colour', e.target.value)} className={inputCls} /></div>
                      <div className="col-span-2"><label className={labelCls}>Bracelet</label><input type="text" value={watch.bracelet} onChange={e => setW('bracelet', e.target.value)} className={inputCls} /></div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {isSell ? (
                <div className="mb-5">
                  <label className={labelCls}>Sold To</label>
                  <input type="text" value={watch.sold_to} onChange={e => setW('sold_to', e.target.value)} className={inputCls} />
                </div>
              ) : (
                <>
                  <div className="mb-5">
                    <label className={labelCls}>Bought From</label>
                    <input type="text" value={watch.bought_from} onChange={e => setW('bought_from', e.target.value)} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div>
                      <label className={labelCls}>Currency</label>
                      <div className="flex gap-1 flex-wrap">
                        {CURRENCIES.map(c => (
                          <button key={c} type="button" onClick={() => { setW('currency', c); if (c === 'USD') setW('convert_rate', '') }}
                            className={watch.currency === c ? 'chip-active py-2 px-2 text-center' : 'chip py-2 px-2 text-center hover:border-accent/40 hover:text-ink'}>{c}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Purchase Price</label>
                      <input type="number" value={watch.purchase_price} onChange={e => setW('purchase_price', e.target.value)} className={inputCls} />
                    </div>
                    {watch.currency !== 'USD' && (
                      <>
                        <div><label className={labelCls}>FX rate to USD</label><input type="number" value={watch.convert_rate} onChange={e => setW('convert_rate', e.target.value)} className={inputCls} /></div>
                        {purchasePriceUSD !== null && <div className="text-green-600 text-sm font-semibold flex items-end">≈ ${purchasePriceUSD.toLocaleString()}</div>}
                      </>
                    )}
                  </div>
                  <div className="mb-5">
                    <label className={labelCls}>Stock Status</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setW('stock_status', 'STOCK')} className={`flex-1 py-2 rounded-2xl text-sm font-semibold border ${watch.stock_status === 'STOCK' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'chip hover:border-accent/40'}`}>In Stock</button>
                      <button type="button" onClick={() => setW('stock_status', 'INCOMING')} className={`flex-1 py-2 rounded-2xl text-sm font-semibold border ${watch.stock_status === 'INCOMING' ? 'bg-amber-50 border-amber-300 text-amber-700' : 'chip hover:border-accent/40'}`}>Incoming</button>
                    </div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Website Price (USD)</label><input type="number" value={watch.website_price} onChange={e => setW('website_price', e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>B2B Price (USD)</label><input type="number" value={watch.b2b_price} onChange={e => setW('b2b_price', e.target.value)} className={inputCls} /></div>
              </div>
            </>
          )}

          {/* ─── STEP 3: PAYMENT (+ location for buy step 3) ─── */}
          {step === 3 && (
            <div className="pt-2">
              <p className="section-label mb-4 flex items-center gap-2">
                <span className="text-base">💳</span> Payment Status
              </p>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {([
                  { val: 'NOT_PAID' as PaymentStatus, icon: '✗', label: 'Not Paid', desc: 'No payment received yet', activeBg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700' },
                  { val: 'PARTIAL' as PaymentStatus, icon: '⏳', label: 'Partial', desc: 'Partial payment received', activeBg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700' },
                  { val: 'PAID' as PaymentStatus, icon: '✓', label: 'Paid', desc: 'Payment complete', activeBg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700' },
                ] as const).map(opt => (
                  <button key={opt.val} type="button"
                    onClick={() => {
                      setP('payment_status', opt.val)
                      if (opt.val === 'NOT_PAID') setP('add_payment_record', false)
                      else setP('add_payment_record', true)
                    }}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      payment.payment_status === opt.val
                        ? `${opt.activeBg} ${opt.border} shadow-sm`
                        : 'bg-panel border-default hover:border-strong'
                    }`}>
                    <div className={`text-2xl mb-2 ${payment.payment_status === opt.val ? opt.text : 'text-muted/40'}`}>{opt.icon}</div>
                    <div className={`text-sm font-black ${payment.payment_status === opt.val ? opt.text : 'text-muted'}`}>{opt.label}</div>
                    <div className="text-xs text-muted mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>

              {payment.payment_status !== 'NOT_PAID' && (
                <div className="border border-default rounded-2xl p-4 bg-panel/40">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-ink">Add Payment Record</p>
                    <button type="button"
                      onClick={() => setP('add_payment_record', !payment.add_payment_record)}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${payment.add_payment_record ? 'bg-accent' : 'bg-panel border border-default'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${payment.add_payment_record ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                  {payment.add_payment_record && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className={labelCls}>Amount</label>
                        <input type="number" value={payment.amount} onChange={e => setP('amount', e.target.value)} placeholder="0.00" min="0" step="0.01" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Currency</label>
                        <select value={payment.pay_currency} onChange={e => setP('pay_currency', e.target.value)} className={inputCls}>
                          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Method</label>
                        <select value={payment.payment_method} onChange={e => setP('payment_method', e.target.value)} className={inputCls}>
                          <option value="CASH">Cash</option>
                          <option value="BANK_TRANSFER">Bank Transfer</option>
                          <option value="CHEQUE">Cheque</option>
                          <option value="CRYPTO">Crypto</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Date</label>
                        <input type="date" value={payment.payment_date} onChange={e => setP('payment_date', e.target.value)} className={inputCls} />
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>Notes <span className="normal-case tracking-normal text-muted/60">(optional)</span></label>
                        <input type="text" value={payment.notes} onChange={e => setP('notes', e.target.value)} placeholder="e.g. Wire transfer ref #1234" className={inputCls} />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!isSell && (
                <div className="border-t border-default pt-5 mt-5">
                  <p className="section-label mb-4">📦 Location</p>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div><label className={labelCls}>From</label><input type="text" value={location.location_from} onChange={e => setL('location_from', e.target.value)} className={inputCls} /></div>
                    <div><label className={labelCls}>To</label><input type="text" value={location.location_to} onChange={e => setL('location_to', e.target.value)} className={inputCls} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['INCOMING', 'IN_TRANSIT', 'IN_STOCK'] as LocationStatus[]).map(s => (
                      <button key={s} type="button" onClick={() => setL('location_status', s)}
                        className={location.location_status === s ? 'chip-active py-2 text-center' : 'chip py-2 text-center hover:border-accent/40 hover:text-ink'}>
                        {s === 'INCOMING' ? 'Incoming' : s === 'IN_TRANSIT' ? 'Transit' : 'In Stock'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Error */}
        {error && (
          <div className="px-6 pb-2">
            <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 border border-red-100">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 px-6 py-5 border-t border-default bg-card rounded-b-3xl">
          <button type="button" onClick={step === 1 ? onClose : handleBack}
            className="flex-1 btn-ghost">
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          {step < totalSteps ? (
            <button type="button" onClick={handleNext}
              className="flex-1 btn-primary">
              Next →
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading}
              className="flex-1 btn-primary disabled:opacity-50">
              {loading ? 'Adding…' : '+ Add Watch'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
