// Plain data constants for task templates — NO prisma, NO server-only imports.
// Safe to import from client components. lib/sell-tasks.ts re-exports these for
// server code, and lib/task-labels.ts imports them directly so the client bundle
// never pulls in PrismaClient.

export const DEFAULT_BUY_TEMPLATES = [
  { label: 'Mark Payment Status', department: 'ACCOUNTING', task_type_key: 'ACCOUNTING_MARK_PAYMENT', is_locked: false, is_builtin: true, default_assignee: null, order: 0 },
  { label: 'Set Price', department: 'SALES', task_type_key: 'SALES_SET_PRICE', is_locked: false, is_builtin: true, default_assignee: null, order: 1 },
  { label: 'Upload to Drive', department: 'SALES', task_type_key: 'SALES_UPLOAD_DRIVE', is_locked: false, is_builtin: true, default_assignee: null, order: 2 },
  { label: 'Upload Photos To Whatsapp Stock Photos', department: 'SALES', task_type_key: 'SALES_UPLOAD_STOCK_GROUP', is_locked: false, is_builtin: true, default_assignee: 'Hasnain Graphics', order: 3 },
  { label: 'Research B2B Price', department: 'SALES', task_type_key: 'SALES_UPDATE_B2B', is_locked: false, is_builtin: true, default_assignee: null, order: 4 },
  { label: 'Get B2C Prices from Josh', department: 'SALES', task_type_key: 'SALES_GET_B2C_PRICES', is_locked: false, is_builtin: true, default_assignee: null, order: 5 },
  { label: 'Set Location', department: 'LOGISTICS', task_type_key: 'LOGISTICS_SET_LOCATION', is_locked: true, is_builtin: true, default_assignee: null, order: 6 },
  { label: 'Update Logistics Cost', department: 'LOGISTICS', task_type_key: 'LOGISTICS_UPDATE_COST', is_locked: false, is_builtin: true, default_assignee: null, order: 7 },
  { label: 'Box', department: 'LOGISTICS', task_type_key: 'LOGISTICS_ACCESSORIES_BOX', is_locked: false, is_builtin: true, default_assignee: null, order: 8 },
  { label: 'Papers', department: 'LOGISTICS', task_type_key: 'LOGISTICS_ACCESSORIES_PAPERS', is_locked: false, is_builtin: true, default_assignee: null, order: 9 },
  { label: 'Extra Links', department: 'LOGISTICS', task_type_key: 'LOGISTICS_ACCESSORIES_EXTRA_LINKS', is_locked: false, is_builtin: true, default_assignee: null, order: 10 },
  { label: 'Warranty Card', department: 'LOGISTICS', task_type_key: 'LOGISTICS_ACCESSORIES_WARRANTY_CARD', is_locked: false, is_builtin: true, default_assignee: null, order: 11 },
  { label: 'Hang Tag', department: 'LOGISTICS', task_type_key: 'LOGISTICS_ACCESSORIES_HANG_TAG', is_locked: false, is_builtin: true, default_assignee: null, order: 12 },
]

export const DEFAULT_SELL_TEMPLATES = [
  { label: 'Logistics Handled',                              department: 'LOGISTICS',  task_type_key: null, is_locked: false, is_builtin: true, default_assignee: 'Haris', order: 0 },
  { label: 'Delete from Drive & Stock List',                 department: 'SALES',      task_type_key: null, is_locked: false, is_builtin: true, default_assignee: 'Aleena',  order: 1 },
  { label: 'Share Shipment Address to Haris',                department: 'SALES',      task_type_key: null, is_locked: false, is_builtin: true, default_assignee: 'Aleena',  order: 2 },
  { label: 'Share Payment Status and Amount to Accounts Team', department: 'SALES',    task_type_key: null, is_locked: false, is_builtin: true, default_assignee: 'Aleena',  order: 3 },
  { label: 'Set Status on FOB',                              department: 'ACCOUNTING', task_type_key: null, is_locked: false, is_builtin: true, default_assignee: 'Hassan',  order: 4 },
  { label: 'Make Invoice to Client',                         department: 'ACCOUNTING', task_type_key: null, is_locked: false, is_builtin: true, default_assignee: 'Hassan',  order: 5 },
]

/** Sell tasks stored as label in task_type that gate downstream pipeline work. */
export const SELL_BLOCKING_TASK_LABELS = new Set([
  'Logistics Handled',
  'Share Payment Status and Amount to Accounts Team',
  'Set Status on FOB',
])
