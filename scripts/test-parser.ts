import { parseWhatsAppWatch } from '../lib/parse-whatsapp-watch'
import assert from 'node:assert/strict'

const cases: Array<{ text: string; expect: { type?: string; stock_no?: string } }> = [
  {
    text: 'Sold 1305 for 680.000 Hkd to Daydate china',
    expect: { type: 'SELL', stock_no: '1305' },
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
  passed++
}
console.log(`parse-whatsapp-watch: ${passed}/${cases.length} tests passed`)
