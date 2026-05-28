export type Department = 'ACCOUNTING' | 'SALES' | 'LOGISTICS'

/** Canonical department order across cards, counts, and task panels */
export const DEPT_ORDER: Department[] = ['ACCOUNTING', 'SALES', 'LOGISTICS']

export const DEPT_CONFIG = {
  ACCOUNTING: {
    label: 'Accounting',
    icon: '💰',
    color: 'text-ink',
    bg: 'bg-card border border-default',
    countColor: 'text-ink',
    solid: 'bg-accent',
    border: 'border-default',
    panelBg: 'bg-panel',
  },
  SALES: {
    label: 'Sales',
    icon: '🤝',
    color: 'text-ink',
    bg: 'bg-card border border-default',
    countColor: 'text-ink',
    solid: 'bg-accent',
    border: 'border-default',
    panelBg: 'bg-panel',
  },
  LOGISTICS: {
    label: 'Logistics',
    icon: '📦',
    color: 'text-ink',
    bg: 'bg-card border border-default',
    countColor: 'text-ink',
    solid: 'bg-accent',
    border: 'border-default',
    panelBg: 'bg-panel',
  },
} as const
