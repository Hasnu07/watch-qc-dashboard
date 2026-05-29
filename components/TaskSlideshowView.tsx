'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePendingDashboard } from '@/hooks/usePendingDashboard'
import { DEPT_CONFIG, type Department } from '@/lib/ui-constants'
import { formatPipelineElapsed, getPipelineUrgency, type PipelineUrgency } from '@/lib/pipeline-timer'
import type { MemberPending, PendingTeamTask, PendingWatchGroup, PendingWatchTask } from '@/lib/pending-dashboard'

const SLIDE_MS = 12_000
const ROWS_PER_SLIDE = 5

const URGENCY_LABEL: Record<PipelineUrgency, string> = {
  fresh: 'Waiting',
  warning: 'Due soon',
  overdue: 'Overdue',
}

type SlideRow =
  | { kind: 'team'; tasks: PendingTeamTask[] }
  | { kind: 'watch'; group: PendingWatchGroup }

interface Slide {
  key: string
  member: MemberPending['member']
  overdue: number
  pending: number
  rows: SlideRow[]
  slideIndex: number
  slideTotal: number
}

function buildRows(member: MemberPending): SlideRow[] {
  const rows: SlideRow[] = []
  if (member.team_tasks.length > 0) {
    rows.push({ kind: 'team', tasks: member.team_tasks })
  }
  for (const group of member.watch_groups) {
    if (group.tasks.length > 0) rows.push({ kind: 'watch', group })
  }
  return rows
}

function buildSlides(members: MemberPending[]): Slide[] {
  const active = members
    .filter(m => m.pending_count > 0)
    .sort((a, b) => b.overdue_count - a.overdue_count || b.pending_count - a.pending_count)

  const slides: Slide[] = []
  for (const member of active) {
    const rows = buildRows(member)
    if (rows.length === 0) continue
    const chunks: SlideRow[][] = []
    for (let i = 0; i < rows.length; i += ROWS_PER_SLIDE) {
      chunks.push(rows.slice(i, i + ROWS_PER_SLIDE))
    }
    chunks.forEach((chunk, i) => {
      slides.push({
        key: `${member.member.id}-${i}`,
        member: member.member,
        overdue: member.overdue_count,
        pending: member.pending_count,
        rows: chunk,
        slideIndex: i,
        slideTotal: chunks.length,
      })
    })
  }
  return slides
}

function TaskPill({ task, now, team }: { task: PendingWatchTask | PendingTeamTask; now: Date; team?: boolean }) {
  const label = team ? (task as PendingTeamTask).message_text : (task as PendingWatchTask).label
  const blocking = !team && (task as PendingWatchTask).is_blocking
  const start = new Date(task.pipeline_started_at)
  const urgency = getPipelineUrgency(start, now)
  const elapsed = formatPipelineElapsed(start, now)

  return (
    <div className={`slideshow-task-pill urgency-${urgency}`}>
      <span className="slideshow-task-pill-title">{label}</span>
      <div className="slideshow-task-pill-meta">
        {blocking && <span className="slideshow-blocking">Blocking</span>}
        <span className="slideshow-urgency">{URGENCY_LABEL[urgency]}</span>
        <span className="slideshow-elapsed font-mono-data">{elapsed}</span>
      </div>
    </div>
  )
}

function WatchLeftPanel({ group }: { group: PendingWatchGroup }) {
  const phaseCls = group.phase === 'SELL' ? 'slideshow-phase-sell' : 'slideshow-phase-buy'
  return (
    <div className="slideshow-watch-panel">
      <span className={`slideshow-phase ${phaseCls}`}>{group.phase}</span>
      <h3 className="slideshow-watch-title">{group.watch_label}</h3>
      {group.stock_no && (
        <p className="slideshow-watch-stock">Stock #{group.stock_no}</p>
      )}
    </div>
  )
}

function SlideContent({ slide, now }: { slide: Slide; now: Date }) {
  const dept = DEPT_CONFIG[slide.member.department as Department]

  return (
    <div className="slideshow-slide-inner">
      <header className="slideshow-header">
        <div className="slideshow-header-left">
          <div className={`slideshow-avatar ${dept.solid}`}>
            {slide.member.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="slideshow-person-name">{slide.member.name}</h1>
            <p className="slideshow-person-dept">{dept.label}</p>
          </div>
        </div>
        <div className="slideshow-header-stats">
          {slide.overdue > 0 && (
            <span className="slideshow-stat-overdue">{slide.overdue} overdue</span>
          )}
          <span className="slideshow-stat-pending">{slide.pending} pending</span>
          {slide.slideTotal > 1 && (
            <span className="slideshow-stat-page">
              Page {slide.slideIndex + 1}/{slide.slideTotal}
            </span>
          )}
        </div>
      </header>

      <div className="slideshow-rows">
        {slide.rows.map((row, i) => (
          <div key={i} className="slideshow-row">
            <div className="slideshow-row-left">
              {row.kind === 'team' ? (
                <div className="slideshow-watch-panel">
                  <span className="slideshow-phase slideshow-phase-team">Team</span>
                  <h3 className="slideshow-watch-title">Team Tasks</h3>
                  <p className="slideshow-watch-stock">{row.tasks.length} task{row.tasks.length !== 1 ? 's' : ''}</p>
                </div>
              ) : (
                <WatchLeftPanel group={row.group} />
              )}
            </div>
            <div className="slideshow-row-right">
              {row.kind === 'team'
                ? row.tasks.map(t => <TaskPill key={t.id} task={t} now={now} team />)
                : row.group.tasks.map(t => <TaskPill key={t.id} task={t} now={now} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TaskSlideshowView() {
  const { data, loading, now } = usePendingDashboard()
  const slides = useMemo(() => buildSlides(data?.members ?? []), [data?.members])
  const [index, setIndex] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    setIndex(0)
  }, [slides.length])

  useEffect(() => {
    if (slides.length <= 1) return
    const id = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % slides.length)
        setFade(true)
      }, 350)
    }, SLIDE_MS)
    return () => clearInterval(id)
  }, [slides.length])

  const slide = slides[index]

  return (
    <div className="task-slideshow-root">
      <div className="slideshow-topbar">
        <span className="slideshow-brand">Task Slideshow</span>
        <div className="slideshow-topbar-meta">
          {slides.length > 0 && (
            <span className="slideshow-rotation">
              {index + 1} / {slides.length} · rotates every {SLIDE_MS / 1000}s
            </span>
          )}
          <Link href="/pending" className="slideshow-exit">Exit</Link>
        </div>
      </div>

      <div className="slideshow-stage">
        {loading ? (
          <div className="slideshow-empty">
            <p className="slideshow-empty-title">Loading tasks…</p>
          </div>
        ) : !slide ? (
          <div className="slideshow-empty">
            <p className="slideshow-empty-title">All caught up</p>
            <p className="slideshow-empty-sub">No pending tasks for anyone right now.</p>
          </div>
        ) : (
          <div className={`slideshow-slide ${fade ? 'slideshow-slide-visible' : 'slideshow-slide-hidden'}`}>
            <SlideContent slide={slide} now={now} />
          </div>
        )}
      </div>

      {slides.length > 1 && (
        <div className="slideshow-dots">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-label={`Show ${s.member.name}`}
              className={`slideshow-dot ${i === index ? 'slideshow-dot-active' : ''}`}
              onClick={() => { setFade(false); setTimeout(() => { setIndex(i); setFade(true) }, 200) }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
