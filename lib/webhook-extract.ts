// Helpers for GreenAPI webhook payload parsing — caption/image extraction and group matching.

type FileMessageData = {
  downloadUrl?: string
  caption?: string
  captionText?: string
  text?: string
  fileName?: string
  mimeType?: string
}

type QuotedMessage = {
  typeMessage?: string
  downloadUrl?: string
  caption?: string
  text?: string
}

type MessageData = {
  typeMessage?: string
  fileMessageData?: FileMessageData
  videoMessageData?: FileMessageData
  imageMessageData?: FileMessageData
  documentMessageData?: FileMessageData
  textMessageData?: { textMessage?: string }
  extendedTextMessageData?: { text?: string; description?: string }
  quotedMessage?: QuotedMessage
}

export function extractWebhookMessage(msg: MessageData): { caption: string; imageUrl: string; msgType: string } {
  const msgType = msg.typeMessage || ''
  const file: FileMessageData =
    msg.fileMessageData ||
    msg.videoMessageData ||
    msg.imageMessageData ||
    msg.documentMessageData ||
    {}

  const quoted = msg.quotedMessage
  const quotedText = (quoted?.caption || quoted?.text || '').trim()

  let caption = (
    file.caption ||
    file.captionText ||
    file.text ||
    msg.textMessageData?.textMessage ||
    msg.extendedTextMessageData?.text ||
    msg.extendedTextMessageData?.description ||
    quotedText ||
    ''
  ).trim()

  // quotedMessage: reply text lives in extendedTextMessageData; merge with quoted caption
  if (msgType === 'quotedMessage') {
    const replyText = (msg.extendedTextMessageData?.text || '').trim()
    caption = [replyText, quotedText].filter(Boolean).join('\n').trim() || caption
  }

  const isImageType = ['imageMessage', 'videoMessage', 'documentMessage'].includes(msgType)
  const isImageDoc = msgType === 'documentMessage' && /image\//i.test(file.mimeType || '')
  let imageUrl = ''

  if (isImageType && (msgType !== 'documentMessage' || isImageDoc)) {
    imageUrl = file.downloadUrl || ''
  }
  if (!imageUrl && quoted?.typeMessage === 'imageMessage') {
    imageUrl = quoted.downloadUrl || ''
  }

  return { caption, imageUrl, msgType }
}

function normalizeGroupId(id: string): string {
  const trimmed = id.trim()
  if (!trimmed) return ''
  return trimmed.includes('@') ? trimmed : `${trimmed}@g.us`
}

export function matchesStockGroup(
  chatId: string,
  chatName: string,
  effectiveId: string,
  effectiveName: string,
): boolean {
  const nameLower = chatName.trim().toLowerCase()
  const effectiveLower = effectiveName.trim().toLowerCase()

  // Exact or comma-separated group IDs
  const ids = effectiveId.split(',').map(normalizeGroupId).filter(Boolean)
  if (ids.some(id => chatId === id)) return true
  if (chatId === normalizeGroupId(effectiveId)) return true

  // Exact or partial group name
  if (effectiveLower && nameLower === effectiveLower) return true
  if (effectiveLower && nameLower.includes(effectiveLower)) return true
  if (effectiveLower && effectiveLower.includes(nameLower) && nameLower.length >= 8) return true

  // Known stock-group keywords (team renames the WhatsApp group occasionally)
  if (/purosangue|buy\s*and\s*sell|stock\s*group|buy\s*\/?\s*sell/i.test(chatName)) return true

  return false
}
