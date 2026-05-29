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
  // Patek Philippe
  '4910/1200A-010': { model: 'Twenty~4', case_material: 'Stainless Steel', dial_colour: 'Blue', bracelet: 'Bracelet' },
  '7118/1200A-010': { model: 'Nautilus Ladies', case_material: 'Stainless Steel', dial_colour: 'Blue', bracelet: 'Integrated' },
  '5711/1A-010':  { model: 'Nautilus', case_material: 'Stainless Steel', dial_colour: 'Blue', bracelet: 'Integrated' },
  '5167A-001':    { model: 'Aquanaut', case_material: 'Stainless Steel', dial_colour: 'Black', bracelet: 'Rubber' },
  '5168G-010':    { model: 'Aquanaut', case_material: 'White Gold', dial_colour: 'Green', bracelet: 'Rubber' },
  '5205R-010':    { model: 'Annual Calendar', case_material: 'Rose Gold', dial_colour: 'Brown', bracelet: 'Leather' },
  '5396G-011':    { model: 'Annual Calendar', case_material: 'White Gold', dial_colour: 'Blue', bracelet: 'Leather' },
  '5270P-014':    { model: 'Perpetual Calendar Chronograph', case_material: 'Platinum', dial_colour: 'Salmon', bracelet: 'Leather' },
  // Audemars Piguet
  '15400ST.OO.1220ST.01': { model: 'Royal Oak', case_material: 'Stainless Steel', dial_colour: 'Blue', bracelet: 'Integrated' },
  '15407ST.OO.1220ST.01': { model: 'Royal Oak Extra-Thin', case_material: 'Stainless Steel', dial_colour: 'Blue', bracelet: 'Integrated' },
  '26240ST.OO.1320ST.01': { model: 'Royal Oak Chronograph', case_material: 'Stainless Steel', dial_colour: 'Blue', bracelet: 'Integrated' },
  '26331ST.OO.1220ST.01': { model: 'Royal Oak Chronograph', case_material: 'Stainless Steel', dial_colour: 'Blue', bracelet: 'Integrated' },
  '15510ST.OO.1320ST.06': { model: 'Royal Oak', case_material: 'Stainless Steel', dial_colour: 'Blue', bracelet: 'Integrated' },
  '26730ST.OO.1320ST.01': { model: 'Royal Oak Offshore Chronograph', case_material: 'Stainless Steel', dial_colour: 'Blue', bracelet: 'Rubber' },
  // Omega
  '310.30.42.50.01.001': { model: 'Speedmaster Moonwatch Professional', case_material: 'Stainless Steel', dial_colour: 'Black', bracelet: 'Bracelet' },
  '310.30.42.50.01.002': { model: 'Speedmaster Moonwatch Professional', case_material: 'Stainless Steel', dial_colour: 'Black', bracelet: 'Bracelet' },
  '210.30.42.20.01.001': { model: 'Seamaster Diver 300M', case_material: 'Stainless Steel', dial_colour: 'Black', bracelet: 'Bracelet' },
  '210.30.42.20.04.001': { model: 'Seamaster Diver 300M', case_material: 'Stainless Steel', dial_colour: 'Blue', bracelet: 'Bracelet' },
  '220.10.41.21.03.001': { model: 'Seamaster Aqua Terra', case_material: 'Stainless Steel', dial_colour: 'Blue', bracelet: 'Bracelet' },
  '131.10.39.20.03.001': { model: 'Constellation', case_material: 'Stainless Steel', dial_colour: 'Blue', bracelet: 'Bracelet' },
}

export async function POST(req: NextRequest) {
  try {
    const { brand, ref_no } = await req.json()
    if (!brand) return NextResponse.json({ error: 'Brand is required' }, { status: 400 })

    // Normalise ref: strip spaces, uppercase
    const refKey = (ref_no || '').replace(/\s/g, '').toUpperCase()
    const refAlt = refKey.replace(/\./g, '')
    const spec = REF_LOOKUP[refKey] || REF_LOOKUP[ref_no] || REF_LOOKUP[refAlt] || null

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
