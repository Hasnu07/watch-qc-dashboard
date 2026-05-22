export async function sendWhatsAppMessage(
  instanceId: string,
  apiToken: string,
  chatId: string,
  message: string,
  apiUrl = 'https://api.green-api.com'
): Promise<boolean> {
  try {
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
