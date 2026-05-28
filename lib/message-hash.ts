export function hashMessage(text: string): string {
  const norm = text.trim().toLowerCase().replace(/\s+/g, ' ')
  let h = 0
  for (let i = 0; i < norm.length; i++) {
    h = ((h << 5) - h + norm.charCodeAt(i)) | 0
  }
  return `m${Math.abs(h).toString(36)}`
}
