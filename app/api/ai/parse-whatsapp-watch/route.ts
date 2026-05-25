import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Parses a free-form WhatsApp caption about a watch transaction and returns
// structured fields. Auto-detects whether it's a purchase ("Seller: …") or a
// sale ("Sold to: …").
export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text required' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: `You parse messy WhatsApp messages from a luxury watch dealer's group chat into structured JSON. The messages are informal, multi-line, often with typos and mixed languages. Some messages aren't transactions at all — they're chatter, reactions, or status updates.

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
  "notes": string | null
}

WHEN TO IMPORT (should_import = true):
- Message describes a watch being bought OR sold ("Sold 1250 to X", "Buy from Y", "Sold to Z")
- Has a customer/seller name AND/OR a price AND/OR a reference number

WHEN TO SKIP (should_import = false, all other fields null):
- Generic status updates ("Watch is delivered", "Watch already given", "All the stuff I put...")
- Meta/procedural messages ("Everyone please react", "Make invoice from estival")
- Pure reactions or emoji-only messages
- Messages without any transaction signal

TYPE DETECTION:
- "Sold", "Sold to", "Sold <number> to", "Sale" → SELL
- "Buy", "Buy from", "Bought from", "Seller" → BUY

REAL EXAMPLES FROM THIS GROUP:

Input: "Sold 1250 to kettle kids\\n55.000 gbp\\nNOT PAID\\nMake invoice from pw Ltd and send in group of kettle kids"
Output: {"should_import": true, "type": "SELL", "stock_no": "1250", "sold_to": "kettle kids", "price": 55000, "currency": "GBP", "payment_status": "NOT_PAID", "notes": "Make invoice from pw Ltd", "brand": null, "model": null, "ref_no": null, "bought_from": null, "case_material": null, "dial_colour": null, "bracelet": null}

Input: "Buy from Arslan\\n126334 Datejust grey\\nCost : 44000 aed\\nNot paid.\\nAlready in inventory Dubai"
Output: {"should_import": true, "type": "BUY", "bought_from": "Arslan", "ref_no": "126334", "brand": "Rolex", "model": "Datejust", "dial_colour": "grey", "price": 44000, "currency": "AED", "payment_status": "NOT_PAID", "notes": "Already in inventory Dubai", "stock_no": null, "sold_to": null, "case_material": null, "bracelet": null}

Input: "Sold to Claudio p\\n1322 for 64000 euro\\nNot paid\\nWatch already given\\nWe need to ship box and paper to Italy"
Output: {"should_import": true, "type": "SELL", "sold_to": "Claudio p", "stock_no": "1322", "price": 64000, "currency": "EUR", "payment_status": "NOT_PAID", "notes": "Ship box and paper to Italy", "brand": null, "model": null, "ref_no": null, "bought_from": null, "case_material": null, "dial_colour": null, "bracelet": null}

Input: "Sold 1365 to salva for 12500 euro not paid\\nMake invoice from estival\\nWe need to ship him box and booklets"
Output: {"should_import": true, "type": "SELL", "stock_no": "1365", "sold_to": "salva", "price": 12500, "currency": "EUR", "payment_status": "NOT_PAID", "notes": "Ship box and booklets", "brand": null, "model": null, "ref_no": null, "bought_from": null, "case_material": null, "dial_colour": null, "bracelet": null}

Input: "Watch is delivered"
Output: {"should_import": false, "type": null, "brand": null, "model": null, "ref_no": null, "stock_no": null, "bought_from": null, "sold_to": null, "price": null, "currency": null, "payment_status": null, "case_material": null, "dial_colour": null, "bracelet": null, "notes": null}

Input: "All the stuff I put need to have a reaction so I know is been proccesd by all the departments"
Output: {"should_import": false, ... (all nulls)}

PARSING DETAILS:
- "1250", "1322", "1365" (3-4 digit numbers near "sold" or "stock") → stock_no
- "126334", "126610LN", "5740/1G-001" (5-7 char Rolex/PP/AP-style) → ref_no
- ref numbers starting with 12xxxx are usually Rolex (Datejust 126334, Submariner 126610, etc.) — set brand to "Rolex"
- Prices written European-style "55.000" or "55,000" = 55000 — strip dots/commas
- Currency words: gbp/£=GBP, eur/euro/€=EUR, aed/dirham=AED, usd/$=USD, hkd=HKD
- "Not paid", "NOT PAID", "not paid" → NOT_PAID
- "Paid", "PAID" → PAID
- "Partial" → PARTIAL
- "notes": short summary of any logistics/invoice instructions in the message
- Never invent fields — null for anything not explicitly in the message.`,
      messages: [{ role: 'user', content: text }],
    })

    const out = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
    const jsonMatch = out.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[AI parse-whatsapp-watch]', err)
    return NextResponse.json({ should_import: false }, { status: 200 })
  }
}
