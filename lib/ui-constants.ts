export type Department = 'ACCOUNTING' | 'SALES' | 'LOGISTICS'

/** Canonical department order across cards, counts, and task panels */
export const DEPT_ORDER: Department[] = ['ACCOUNTING', 'SALES', 'LOGISTICS']

export const DEPT_CONFIG = {
  ACCOUNTING: {
    label: 'Accounting',
    icon: '💰',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border border-amber-100',
    countColor: 'text-amber-900',
    solid: 'bg-amber-500',
    border: 'border-amber-200',
    panelBg: 'bg-amber-50',
  },
  SALES: {
    label: 'Sales',
    icon: '🤝',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border border-emerald-100',
    countColor: 'text-emerald-900',
    solid: 'bg-emerald-500',
    border: 'border-emerald-200',
    panelBg: 'bg-emerald-50',
  },
  LOGISTICS: {
    label: 'Logistics',
    icon: '📦',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border border-blue-100',
    countColor: 'text-blue-900',
    solid: 'bg-blue-500',
    border: 'border-blue-200',
    panelBg: 'bg-blue-50',
  },
} as const
