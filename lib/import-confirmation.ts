import { prisma } from './prisma'
import { sendWhatsAppMessage } from './greenapi'

async function getGreenAPISettings() {
  const [inst, tok, url] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'greenapi_instance_id' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_token' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_url' } }),
  ])
  if (!inst?.value || !tok?.value) return null
  return { instanceId: inst.value, token: tok.value, apiUrl: url?.value || 'https://api.green-api.com' }
}

export async function sendImportGroupConfirmation(
  chatId: string,
  watch: { id: number; name: string; brand: string | null; model: string | null; stock_no: string | null },
  watchType: 'BUY' | 'SELL',
) {
  const settings = await getGreenAPISettings()
  if (!settings || !chatId) return false

  const label = [watch.brand, watch.model].filter(Boolean).join(' ') || watch.name

  if (watchType === 'BUY') {
    const msg = `✓ Buy #${watch.stock_no || watch.id} added · ${label}`
    return sendWhatsAppMessage(settings.instanceId, settings.token, chatId, msg, settings.apiUrl)
  }

  const tasks = await prisma.watchTask.findMany({
    where: { watch_id: watch.id, phase: 'SELL' },
    select: { assigned_to: true },
  })
  const assignees = Array.from(new Set(
    tasks.map(t => t.assigned_to).filter((n): n is string => !!n),
  ))
  const assigneeLine = assignees.length > 0 ? assignees.join('/') : 'team'

  const stockLabel = watch.stock_no ? `#${watch.stock_no}` : `#${watch.id}`
  const msg = `✓ Sell ${stockLabel} added · ${label} · tasks sent to ${assigneeLine}.`
  return sendWhatsAppMessage(settings.instanceId, settings.token, chatId, msg, settings.apiUrl)
}
