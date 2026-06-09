import { parseWhatsAppWatch } from '../lib/parse-whatsapp-watch'
import assert from 'node:assert/strict'

const cases: Array<{ text: string; expect: { type?: string; stock_no?: string; sold_to?: string } }> = [
  {
    text: 'Sold 1305 for 680.000 Hkd to Daydate china',
    expect: { type: 'SELL', stock_no: '1305' },
  },
  {
    text: 'sold 1366',
    expect: { type: 'SELL', stock_no: '1366' },
  },
  {
    text: '1366 sold',
    expect: { type: 'SELL', stock_no: '1366' },
  },
  {
    text: '1366 → ali',
    expect: { type: 'SELL', stock_no: '1366', sold_to: 'ali' },
  },
  {
    text: 'WATCH DATE: 05/2026 — 170100 usdt paid — sold do duncan (ummay sale)\nSTOCK NUMBER: 1302',
    expect: { type: 'SELL', stock_no: '1302', sold_to: 'duncan (ummay sale)' },
  },
  {
    text: 'Sold 1195 to Winson\nFor 3050.000 Hkd not paid\nHe will collect from RK the watch',
    expect: { type: 'SELL', stock_no: '1195', sold_to: 'Winson' },
  },
  {
    text: "Seller Robin\nModel Audemars Piguet Royal Oak\nReference15510ST.OO.1320ST.08\nDial:White\nBracelet: Steel bracelet\nOriginal price: 31'600 CHF\nFor Hassan (Accounting)\nFor Haris (Logistics)",
    expect: { type: 'BUY' },
  },
  {
    text: 'Seller: Diego Giminez\nModel: Audemars Piguet Royal Oak\nReference: 15407OR.OO.1220OR.01\nStock No: 1377',
    expect: { type: 'BUY', stock_no: '1377' },
  },
]

let passed = 0
for (const c of cases) {
  const r = parseWhatsAppWatch(c.text)
  assert.notEqual(r.should_import, false, `should import: ${c.text.slice(0, 40)}`)
  if (c.expect.type) assert.equal(r.type, c.expect.type)
  if (c.expect.stock_no) assert.equal(r.stock_no, c.expect.stock_no)
  if (c.expect.sold_to) assert.equal(r.sold_to, c.expect.sold_to)
  passed++
}
console.log(`parse-whatsapp-watch: ${passed}/${cases.length} tests passed`)
