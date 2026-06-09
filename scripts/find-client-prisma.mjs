// Static import tracer: find every 'use client' file whose import graph
// transitively reaches lib/prisma (or any server-only module), which crashes
// the browser bundle. Reports the exact chain.
import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const SRC_DIRS = ['app', 'components', 'hooks', 'lib']
const exts = ['.ts', '.tsx', '.js', '.jsx']

function resolveImport(fromFile, spec) {
  let base
  if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec)
  else return null // node_modules
  for (const e of exts) {
    if (fs.existsSync(base + e)) return base + e
    const idx = path.join(base, 'index' + e)
    if (fs.existsSync(idx)) return idx
  }
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base
  return null
}

function readImports(file) {
  const src = fs.readFileSync(file, 'utf8')
  const imports = []
  // match: import ... from '...'  and  import '...'  (skip `import type`)
  const re = /import\s+(type\s+)?[^'"]*?from\s*['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(src)) !== null) {
    if (m[1]) continue // import type — erased, no runtime bundle
    const spec = m[2] || m[3]
    if (spec) imports.push(spec)
  }
  return src
    ? { isClient: /^['"]use client['"]/m.test(src.split('\n').slice(0, 3).join('\n')), imports }
    : { isClient: false, imports }
}

const PRISMA_FILE = path.join(ROOT, 'lib', 'prisma.ts')

function reachesPrisma(file, seen = new Set(), chain = []) {
  if (seen.has(file)) return null
  seen.add(file)
  if (path.resolve(file) === path.resolve(PRISMA_FILE)) return [...chain, 'lib/prisma.ts']
  let info
  try { info = readImports(file) } catch { return null }
  for (const spec of info.imports) {
    const resolved = resolveImport(file, spec)
    if (!resolved) continue
    const rel = path.relative(ROOT, resolved).replace(/\\/g, '/')
    const result = reachesPrisma(resolved, seen, [...chain, rel])
    if (result) return result
  }
  return null
}

// Gather all client files
const clientFiles = []
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) { if (name !== 'node_modules' && name !== '.next') walk(full) }
    else if (exts.includes(path.extname(full))) {
      const src = fs.readFileSync(full, 'utf8')
      if (/^\s*['"]use client['"]/m.test(src.split('\n').slice(0, 5).join('\n'))) {
        clientFiles.push(full)
      }
    }
  }
}
for (const d of SRC_DIRS) { const p = path.join(ROOT, d); if (fs.existsSync(p)) walk(p) }

console.log(`Scanning ${clientFiles.length} 'use client' files for prisma leaks...\n`)
let found = 0
for (const cf of clientFiles) {
  const chain = reachesPrisma(cf)
  if (chain) {
    found++
    const rel = path.relative(ROOT, cf).replace(/\\/g, '/')
    console.log(`✗ ${rel}`)
    console.log(`   chain: ${chain.join(' → ')}\n`)
  }
}
console.log(found === 0 ? '✓ No client → prisma leaks found.' : `\n✗ ${found} client file(s) leak prisma into the browser.`)
