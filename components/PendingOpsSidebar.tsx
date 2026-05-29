'use client'

import type { PendingFilter, PendingSummary } from '@/lib/pending-dashboard'

interface PendingOpsSidebarProps {
  summary: PendingSummary | null
  loading?: boolean
  filter?: PendingFilter
  onFilterChange?: (filter: PendingFilter) => void
  onFocusUnassigned?: () => void
}

function DeptBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="pending-ops-dept-row">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted">{label}</span>
        <span className="font-bold text-ink tabular-nums">{count}</span>
      </div>
      <div className="pending-ops-dept-track">
        <div className="pending-ops-dept-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function StatButton({
  label,
  value,
  valueClass,
  onClick,
  disabled,
}: {
  label: string
  value: string | number
  valueClass?: string
  onClick?: () => void
  disabled?: boolean
}) {
  const Tag = onClick && !disabled ? 'button' : 'div'
  return (
    <Tag
      type={Tag === 'button' ? 'button' : undefined}
      className={`pending-ops-stat ${onClick && !disabled ? 'pending-ops-stat-clickable' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="pending-ops-stat-label">{label}</span>
      <span className={`pending-ops-stat-value ${valueClass ?? 'text-ink'}`}>{value}</span>
    </Tag>
  )
}

export default function PendingOpsSidebar({
  summary,
  loading,
  onFilterChange,
  onFocusUnassigned,
}: PendingOpsSidebarProps) {
  if (loading || !summary) {
    return (
      <aside className="pending-ops-sidebar">
        <div className="pending-ops-card animate-pulse h-32 bg-panel rounded-xl" />
        <div className="pending-ops-card animate-pulse h-24 bg-panel rounded-xl" />
      </aside>
    )
  }

  const maxDept = Math.max(
    summary.by_department.ACCOUNTING,
    summary.by_department.SALES,
    summary.by_department.LOGISTICS,
    1,
  )

  const gaugeColor =
    summary.health_score >= 80 ? 'var(--color-positive)' :
    summary.health_score >= 60 ? '#ffb74d' :
    'var(--color-negative)'

  return (
    <aside className="pending-ops-sidebar">
      <div className="pending-ops-card">
        <p className="pending-ops-card-label">Pipeline health</p>
        <div className="pending-ops-gauge-wrap">
          <svg viewBox="0 0 120 70" className="pending-ops-gauge" aria-hidden>
            <path
              d="M 10 60 A 50 50 0 0 1 110 60"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 10 60 A 50 50 0 0 1 110 60"
              fill="none"
              stroke={gaugeColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(summary.health_score / 100) * 157} 157`}
            />
          </svg>
          <div className="pending-ops-gauge-value">
            <span className="text-2xl font-bold text-ink tabular-nums">{summary.health_score}%</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{summary.health_label}</span>
          </div>
        </div>
      </div>

      <div className="pending-ops-card pending-ops-stats-grid">
        <StatButton
          label="Overdue"
          value={summary.overdue_count}
          valueClass={summary.overdue_count > 0 ? 'text-negative' : 'text-ink'}
          onClick={() => onFilterChange?.('overdue')}
          disabled={!onFilterChange || summary.overdue_count === 0}
        />
        <StatButton
          label="Unassigned"
          value={summary.unassigned_count}
          valueClass={summary.unassigned_count > 0 ? 'text-negative' : 'text-ink'}
          onClick={() => onFocusUnassigned?.()}
          disabled={!onFocusUnassigned || summary.unassigned_count === 0}
        />
        <StatButton
          label="Cleared 24h"
          value={summary.cleared_24h}
          valueClass="text-positive"
        />
        <StatButton
          label="Oldest overdue"
          value={summary.oldest_overdue_label}
          valueClass="text-ink text-base font-mono-data"
        />
      </div>

      <div className="pending-ops-card">
        <p className="pending-ops-card-label">By department</p>
        <div className="space-y-3 mt-2">
          <DeptBar label="Accounting" count={summary.by_department.ACCOUNTING} max={maxDept} />
          <DeptBar label="Sales" count={summary.by_department.SALES} max={maxDept} />
          <DeptBar label="Logistics" count={summary.by_department.LOGISTICS} max={maxDept} />
        </div>
      </div>

      <div className="pending-ops-card">
        <p className="pending-ops-card-label">Totals</p>
        <p className="text-sm text-ink mt-1">
          <button
            type="button"
            className="font-bold tabular-nums hover:underline"
            onClick={() => onFilterChange?.('all')}
            disabled={!onFilterChange}
          >
            {summary.total_pending}
          </button>
          <span className="text-muted"> pending · </span>
          <button
            type="button"
            className="font-bold tabular-nums text-[#ffb74d] hover:underline"
            onClick={() => onFilterChange?.('due_soon')}
            disabled={!onFilterChange || summary.due_soon_count === 0}
          >
            {summary.due_soon_count}
          </button>
          <span className="text-muted"> due soon</span>
        </p>
      </div>
    </aside>
  )
}
