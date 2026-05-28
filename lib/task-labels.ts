import { DEFAULT_SELL_TEMPLATES } from './sell-tasks'

export const BUY_TASK_LABELS: Record<string, string> = {
  ACCOUNTING_MARK_PAYMENT: 'Mark Payment Status',
  SALES_SET_PRICE: 'Set Price',
  SALES_UPLOAD_DRIVE: 'Upload to Drive',
  SALES_UPLOAD_STOCK_GROUP: 'Upload Photos To Whatsapp Stock Photos',
  SALES_UPDATE_B2B: 'Research B2B Price',
  SALES_GET_B2C_PRICES: 'Get B2C Prices from Josh',
  LOGISTICS_SET_LOCATION: 'Set Location',
  LOGISTICS_UPDATE_COST: 'Update Logistics Cost',
  LOGISTICS_ACCESSORIES_BOX: 'Box',
  LOGISTICS_ACCESSORIES_PAPERS: 'Papers',
  LOGISTICS_ACCESSORIES_EXTRA_LINKS: 'Extra Links',
  LOGISTICS_ACCESSORIES_WARRANTY_CARD: 'Warranty Card',
  LOGISTICS_ACCESSORIES_HANG_TAG: 'Hang Tag',
}

const SELL_LABELS_FROM_TEMPLATES = Object.fromEntries(
  DEFAULT_SELL_TEMPLATES.flatMap(t => {
    const entries: [string, string][] = [[t.label, t.label]]
    if (t.task_type_key) entries.push([t.task_type_key, t.label])
    return entries
  }),
)

export function getTaskLabel(taskType: string, phase?: 'BUY' | 'SELL'): string {
  if (phase === 'SELL' || !BUY_TASK_LABELS[taskType]) {
    return SELL_LABELS_FROM_TEMPLATES[taskType] ?? BUY_TASK_LABELS[taskType] ?? taskType
  }
  return BUY_TASK_LABELS[taskType] ?? taskType
}
