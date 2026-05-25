// Shared in-memory state for the GreenAPI webhook diagnostic UI.
// Lives outside the route file so Next.js doesn't reject extra exports.

export type RecentGroup = { chatId: string; chatName: string; lastSeenAt: number }
export type WebhookHit = {
  ts: number
  type: string
  chatId: string
  chatName: string
  msgType: string
  hasImage: boolean
  caption: string
  outcome: string
  watchId?: number
}

const recentGroups = new Map<string, RecentGroup>()
const recentHits: WebhookHit[] = []
const MAX_HITS = 25

export function trackGroup(chatId: string, chatName: string) {
  recentGroups.set(chatId, { chatId, chatName, lastSeenAt: Date.now() })
}

export function getRecentGroups(): RecentGroup[] {
  return Array.from(recentGroups.values()).sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, 20)
}

export function logHit(hit: WebhookHit) {
  recentHits.unshift(hit)
  if (recentHits.length > MAX_HITS) recentHits.length = MAX_HITS
  console.log(`[Webhook] ${hit.outcome}: chatId=${hit.chatId} chat="${hit.chatName}" msgType=${hit.msgType} image=${hit.hasImage} caption="${hit.caption.slice(0, 80)}"`)
}

export function getRecentHits(): WebhookHit[] {
  return recentHits.slice()
}
