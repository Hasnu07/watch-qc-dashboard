import { prisma } from './prisma'

let autoSendCache: { value: boolean; ts: number } | null = null

async function isWhatsAppAutoSendEnabled(): Promise<boolean> {
  const now = Date.now()
  if (autoSendCache && now - autoSendCache.ts < 5000) return autoSendCache.value
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'whatsapp_auto_send' } })
    const enabled = row?.value !== '0'
    autoSendCache = { value: enabled, ts: now }
    return enabled
  } catch {
    // Fail-open so messaging still works if DB is temporarily unreachable.
    return true
  }
}

export async function sendWhatsAppMessage(
  instanceId: string,
  apiToken: string,
  chatId: string,
  message: string,
  apiUrl = 'https://api.green-api.com'
): Promise<boolean> {
  try {
    if (!(await isWhatsAppAutoSendEnabled())) {
      console.log('[WhatsApp] auto-send disabled; message suppressed')
      return true
    }
    const base = apiUrl.replace(/\/$/, '')
    const url = `${base}/waInstance${instanceId}/sendMessage/${apiToken}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`GreenAPI error ${res.status}: ${text}`)
      return false
    }
    return true
  } catch (err) {
    console.error('GreenAPI send error:', err)
    return false
  }
}

// Format whatsapp number to GreenAPI chatId: "923001234567" -> "923001234567@c.us"
export function toChatId(number: string): string {
  const clean = number.replace(/[^0-9]/g, '')
  return `${clean}@c.us`
}

// Extract number from GreenAPI chatId: "923001234567@c.us" -> "923001234567"
export function fromChatId(chatId: string): string {
  return chatId.replace('@c.us', '').replace('@g.us', '')
}
