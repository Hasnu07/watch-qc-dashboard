import Anthropic from '@anthropic-ai/sdk'

export interface ParsedWatch {
  should_import?: boolean
  type?: 'BUY' | 'SELL' | null
  brand?: string | null
  model?: string | null
  ref_no?: string | null
  stock_no?: string | null
  bought_from?: string | null
  sold_to?: string | null
  price?: number | null
  currency?: 'USD' | 'GBP' | 'EUR' | 'AED' | 'HKD' | null
  payment_status?: 'PAID' | 'PARTIAL' | 'NOT_PAID' | null
  case_material?: string | null
  dial_colour?: string | null
  bracelet?: string | null
  watch_date?: string | null
  location_status?: 'INCOMING' | 'IN_STOCK' | 'IN_TRANSIT' | null
  location_from?: string | null
  location_to?: string | null
  notes?: string | null
}

const SYSTEM_PROMPT = `You parse WhatsApp messages from a luxury watch dealer's group chat into structured JSON. Messages range from casual buy/sell notes to fully formatted watch cards with task sections for team members. Some messages aren't transactions at all.

Reply with ONLY valid JSON (no markdown, no commentary) in this exact shape:
{
  "should_import": true | false,
  "type": "BUY" | "SELL" | null,
  "brand": string | null,
  "model": string | null,
  "ref_no": string | null,
  "stock_no": string | null,
  "bought_from": string | null,
  "sold_to": string | null,
  "price": number | null,
  "currency": "USD" | "GBP" | "EUR" | "AED" | "HKD" | null,
  "payment_status": "PAID" | "PARTIAL" | "NOT_PAID" | null,
  "case_material": string | null,
  "dial_colour": string | null,
  "bracelet": string | null,
  "watch_date": string | null,
  "location_status": "INCOMING" | "IN_STOCK" | "IN_TRANSIT" | null,
  "location_from": string | null,
  "location_to": string | null,
  "notes": string | null
}

WHEN TO IMPORT (should_import = true):
- Message describes a watch being bought OR sold
- Has any of: seller name, buyer name, price, reference number, model
- Structured watch cards with fields like "Seller:", "Model:", "Reference:", "Purchase Price:" are ALWAYS imports
- Messages with task sections "For Hassan (Accounting):" or "For Haris (Logistics):" are ALWAYS imports — those are internal workflow notes attached to a purchase

WHEN TO SKIP (should_import = false, all other fields null):
- Pure status updates ("Watch is delivered", "Watch already given")
- Meta/procedural messages ("Everyone please react", "Make invoice from estival")
- Pure reactions, emoji-only, or greetings

TYPE DETECTION:
- "Sold", "Sold to", "Sold <number> to", "Sale" → SELL
- "Buy", "Buy from", "Bought from", "Seller", "Seller:", "Purchase Price" → BUY

LOCATION DETECTION:
- "Incoming", "Incoming Inventory", "Incoming Dubai" → location_status: "INCOMING"
- "In Transit", "In transit to" → location_status: "IN_TRANSIT"
- "In Stock", "Stock" (without Incoming/Transit context) → location_status: "IN_STOCK"
- "Location: Italy – Incoming Inventory Dubai" → location_status: "INCOMING", location_from: "Italy", location_to: "Dubai"
- "Watch currently in Italy, shipping to Dubai" → location_from: "Italy", location_to: "Dubai"

EXAMPLES:

Input: "Sold 1250 to kettle kids\\n55.000 gbp\\nNOT PAID\\nMake invoice from pw Ltd"
Output: {"should_import": true, "type": "SELL", "stock_no": "1250", "sold_to": "kettle kids", "price": 55000, "currency": "GBP", "payment_status": "NOT_PAID", "notes": "Make invoice from pw Ltd", "brand": null, "model": null, "ref_no": null, "bought_from": null, "case_material": null, "dial_colour": null, "bracelet": null, "watch_date": null, "location_status": null, "location_from": null, "location_to": null}

Input: "Buy from Arslan\\n126334 Datejust grey\\nCost : 44000 aed\\nNot paid."
Output: {"should_import": true, "type": "BUY", "bought_from": "Arslan", "ref_no": "126334", "brand": "Rolex", "model": "Datejust", "dial_colour": "grey", "price": 44000, "currency": "AED", "payment_status": "NOT_PAID", "stock_no": null, "sold_to": null, "case_material": null, "bracelet": null, "watch_date": null, "location_status": null, "location_from": null, "location_to": null, "notes": null}

Input: "Seller: Diego Giminez\\nModel: Patek Philippe Cubitus\\nReference: 7128/1G-001\\nDial: Blue Dial\\nBracelet: White Gold Bracelet\\nPurchase Price: 102,000 euro\\nPayment Status: Not Paid"
Output: {"should_import": true, "type": "BUY", "bought_from": "Diego Giminez", "brand": "Patek Philippe", "model": "Cubitus", "ref_no": "7128/1G-001", "dial_colour": "Blue Dial", "bracelet": "White Gold Bracelet", "price": 102000, "currency": "EUR", "payment_status": "NOT_PAID", "stock_no": null, "sold_to": null, "case_material": null, "watch_date": null, "location_status": null, "location_from": null, "location_to": null, "notes": null}

Input: "Seller: Ale Italy\\n\\nModel: Patek Philippe Cubitus\\nReference: 7128/1R-001\\nDial: Brown Dial\\nBracelet: Rose Gold Bracelet\\nWatch Date: 05/2026\\nPurchase Price: 132,000 euro\\nPayment Status: ❌ Not Paid\\nSet: Full set\\nLocation: 📍 Italy – Incoming Inventory Dubai\\n\\n🧾 For Hassan (Accounting):\\n· Register in Inventory – Incoming Dubai\\n· Seller: Ale Italy\\n· Status: Not Paid\\n· Amount: 132,000 euro\\n· Enter in ledger and FOB\\n\\n📦 For Haris (Logistics):\\n· Seller: Ale Italy\\n· Watch currently in Italy\\n· Arrange shipment from Italy to Dubai\\n· Full set"
Output: {"should_import": true, "type": "BUY", "bought_from": "Ale Italy", "brand": "Patek Philippe", "model": "Cubitus", "ref_no": "7128/1R-001", "dial_colour": "Brown Dial", "bracelet": "Rose Gold Bracelet", "watch_date": "05/2026", "price": 132000, "currency": "EUR", "payment_status": "NOT_PAID", "location_status": "INCOMING", "location_from": "Italy", "location_to": "Dubai", "stock_no": null, "sold_to": null, "case_material": null, "notes": "Full set"}

Input: "Watch is delivered"
Output: {"should_import": false, "type": null, "brand": null, "model": null, "ref_no": null, "stock_no": null, "bought_from": null, "sold_to": null, "price": null, "currency": null, "payment_status": null, "case_material": null, "dial_colour": null, "bracelet": null, "watch_date": null, "location_status": null, "location_from": null, "location_to": null, "notes": null}

PARSING DETAILS:
- "1250", "1322", "1365" (3-4 digit numbers near "sold" or "stock") → stock_no
- "126334", "126610LN", "7128/1G-001" → ref_no
- ref numbers starting with 12xxxx are usually Rolex → set brand to "Rolex"
- Prices written European-style "55.000" or "55,000" or "102,000" or "132,000" = 55000 / 102000 / 132000 — strip dots/commas
- Currency words: gbp/£=GBP, eur/euro/€=EUR, aed/dirham=AED, usd/$=USD, hkd=HKD
- "Not paid", "NOT PAID", "❌ Not Paid" → NOT_PAID
- "Paid", "PAID", "✓ Paid" → PAID
- "Partial" → PARTIAL
- The "For [Name] (Dept):" sections contain workflow tasks — use them only for context clues (seller name, amount), do NOT let them override the main watch fields
- "notes": short summary of any useful extra info (set completeness, special instructions)
- Never invent fields — null for anything not explicitly in the message.`

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function parseWhatsAppWatch(text: string): Promise<ParsedWatch> {
  if (!text || !text.trim()) return { should_import: false }
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    })
    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    return JSON.parse(jsonMatch[0]) as ParsedWatch
  } catch (err) {
    console.error('[parseWhatsAppWatch]', err)
    return { should_import: false }
  }
}
