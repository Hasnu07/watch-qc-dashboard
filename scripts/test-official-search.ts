import { searchOfficialBrandImage } from '../lib/official-watch-images'

const cases = [
  ['Rolex', '126519LN', 'Daytona'],
  ['Audemars Piguet', '15407OR.OO.1220OR.01', 'Royal Oak Double Balance Wheel Openworked'],
  ['Patek Philippe', '7118/1200A-001', 'Nautilus'],
] as const

async function main() {
  for (const [brand, ref, model] of cases) {
    const url = await searchOfficialBrandImage(brand, ref, model)
    console.log({ brand, ref, ok: !!url, url: url?.slice(0, 100) })
  }
}

main().catch(console.error)
