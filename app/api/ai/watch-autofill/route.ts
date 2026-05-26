import { NextRequest, NextResponse } from 'next/server'

// Free static lookup table for common references — no AI, no API costs.
// Add entries here as needed.
type WatchSpec = { model: string; case_material: string; dial_colour: string; bracelet: string }

const REF_LOOKUP: Record<string, WatchSpec> = {
  '116500LN': { model: 'Daytona', case_material: 'Oystersteel', dial_colour: 'White', bracelet: 'Oyster' },
  '126500LN': { model: 'Daytona', case_material: 'Oystersteel', dial_colour: 'White', bracelet: 'Oyster' },
  '126519LN': { model: 'Daytona Oysterflex', case_material: 'White Gold', dial_colour: 'Meteorite', bracelet: 'Oysterflex' },
  '116520':   { model: 'Daytona', case_material: 'Oystersteel', dial_colour: 'White', bracelet: 'Oyster' },
  '126610LN': { model: 'Submariner Date', case_material: 'Oystersteel', dial_colour: 'Black', bracelet: 'Oyster' },
  '126610LV': { model: 'Submariner Date', case_material: 'Oystersteel', dial_colour: 'Green', bracelet: 'Oyster' },
  '124300':   { model: 'Oyster Perpetual 41', case_material: 'Oystersteel', dial_colour: 'Blue', bracelet: 'Oyster' },
  '126234':   { model: 'Datejust 36', case_material: 'Oystersteel', dial_colour: 'White', bracelet: 'Jubilee' },
  '126334':   { model: 'Datejust 41', case_material: 'Oystersteel', dial_colour: 'Grey', bracelet: 'Jubilee' },
  '126333':   { model: 'Datejust 41', case_material: 'Rolesor', dial_colour: 'Black', bracelet: 'Jubilee' },
  '228238':   { model: 'Day-Date 40', case_material: 'Yellow Gold', dial_colour: 'Champagne', bracelet: 'President' },
  '228239':   { model: 'Day-Date 40', case_material: 'White Gold', dial_colour: 'Ice Blue', bracelet: 'President' },
  '218239':   { model: 'Day-Date 36', case_material: 'White Gold', dial_colour: 'White', bracelet: 'President' },
  '326935':   { model: 'Sky-Dweller', case_material: 'Everose Gold', dial_colour: 'Chocolate', bracelet: 'Oyster' },
  '5711/1A':  { model: 'Nautilus', case_material: 'Stainless Steel', dial_colour: 'Blue', bracelet: 'Integrated' },
  '5726A':    { model: 'Nautilus Annual Calendar', case_material: 'Stainless Steel', dial_colour: 'Blue', bracelet: 'Integrated' },
  '7128/1G-001': { model: 'Cubitus', case_material: 'White Gold', dial_colour: 'Blue', bracelet: 'White Gold' },
  '7128/1R-001': { model: 'Cubitus', case_material: 'Rose Gold', dial_colour: 'Brown', bracelet: 'Rose Gold' },
  '5968A':    { model: 'Aquanaut Chronograph', case_material: 'Stainless Steel', dial_colour: 'Black', bracelet: 'Rubber' },
  '15202ST':  { model: 'Royal Oak Jumbo Extra-Thin', case_material: 'Stainless Steel', dial_colour: 'Blue', bracelet: 'Integrated' },
  '15500ST':  { model: 'Royal Oak', case_material: 'Stainless Steel', dial_colour: 'Blue', bracelet: 'Integrated' },
  '26600TI':  { model: 'Big Bang Integral Titanium', case_material: 'Titanium', dial_colour: 'Blue', bracelet: 'Integrated' },
}

export async function POST(req: NextRequest) {
  try {
    const { brand, ref_no } = await req.json()
    if (!brand) return NextResponse.json({ error: 'Brand is required' }, { status: 400 })

    // Normalise ref: strip spaces, uppercase
    const refKey = (ref_no || '').replace(/\s/g, '').toUpperCase()
    const spec = REF_LOOKUP[refKey] || REF_LOOKUP[ref_no] || null

    if (spec) {
      return NextResponse.json(spec)
    }

    // Nothing found — return empty so the form stays blank
    return NextResponse.json({ model: '', case_material: '', dial_colour: '', bracelet: '' })
  } catch (err) {
    console.error('[Autofill]', err)
    return NextResponse.json({ model: '', case_material: '', dial_colour: '', bracelet: '' })
  }
}
