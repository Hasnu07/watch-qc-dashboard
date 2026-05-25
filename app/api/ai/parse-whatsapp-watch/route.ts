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
      max_tokens: 512,
      system: `You parse WhatsApp messages from a luxury watch dealer's group chat into structured JSON.

The dealer either BUYS watches ("Seller: <name>" / "Bought from: <name>" / "from: <name>") or SELLS watches ("Sold to: <name>" / "Sold: <name>").

Reply with ONLY valid JSON (no markdown, no commentary) in this exact shape:
{
  "type": "BUY" | "SELL",
  "brand": string | null,
  "model": string | null,
  "ref_no": string | null,
  "stock_no": string | null,
  "bought_from": string | null,
  "sold_to": string | null,
  "website_price": number | null,
  "b2b_price": number | null,
  "case_material": string | null,
  "dial_colour": string | null,
  "bracelet": string | null
}

Rules:
- "type": SELL if caption mentions "sold", "sold to", "sale to". BUY if it mentions "seller", "bought from", "from <name>". If unclear, default to BUY.
- For SELL: populate sold_to, leave bought_from null. For BUY: populate bought_from, leave sold_to null.
- "ref_no" examples: "126610LN", "5740/1G-001", "15500ST".
- "stock_no" examples: "STK-001", "#001", "S-12".
- Prices: strip currency symbols and commas — return raw numbers. Leave null if not mentioned.
- If a field is not in the message, use null. Do not invent values.
- "brand" must be the watchmaker (Rolex, Patek Philippe, Audemars Piguet, Tudor, Cartier, etc.).`,
      messages: [{ role: 'user', content: text }],
    })

    const out = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
    const jsonMatch = out.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[AI parse-whatsapp-watch]', err)
    return NextResponse.json({ type: 'BUY' }, { status: 200 })
  }
}
