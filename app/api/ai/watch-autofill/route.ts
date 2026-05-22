import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { brand, ref_no, model } = await req.json()

    if (!brand) {
      return NextResponse.json({ error: 'Brand is required' }, { status: 400 })
    }

    const prompt = `Watch brand: ${brand}${ref_no ? `\nReference number: ${ref_no}` : ''}${model ? `\nModel hint: ${model}` : ''}`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: `You are a luxury watch expert database. Given a watch brand and optionally a reference number, identify the watch and return its specifications.
Reply with ONLY valid JSON, no markdown, no explanation:
{"model": "...", "case_material": "...", "dial_colour": "...", "bracelet": "..."}
Be specific. Examples: model "Submariner Date 41", case_material "Oystersteel", dial_colour "Black", bracelet "Oyster Bracelet".
If uncertain, make your best educated guess based on the brand and reference number pattern.`,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'

    // Extract JSON even if Claude adds extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (err) {
    console.error('[AI Autofill]', err)
    return NextResponse.json(
      { model: '', case_material: '', dial_colour: '', bracelet: '' },
      { status: 200 }
    )
  }
}
