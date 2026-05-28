'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSseStatus } from '@/components/SseProvider'

export default function NavBar() {
  const pathname = usePathname()
  const { connected } = useSseStatus()

  const navLink = (href: string, label: string, subtitle?: string) => {
    const active = pathname === href
    return (
      <Link
        href={href}
        className={`px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-medium tracking-wide transition-colors whitespace-nowrap ${
          active
            ? 'text-accent border-b-2 border-accent pb-0.5'
            : 'text-muted hover:text-ink'
        }`}
        title={subtitle}
      >
        {label}
      </Link>
    )
  }

  const liveBadge = (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${
      connected ? 'border-accent/40 text-accent bg-accent/5' : 'border-default text-muted bg-card'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-accent live-dot' : 'bg-muted'}`} />
      <span>{connected ? 'Live' : 'Poll'}</span>
    </div>
  )

  return (
    <nav className="sticky top-0 z-50 bg-surface/95 backdrop-blur-sm border-b border-default">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-3 sm:py-4">
        {/* Desktop: nav — title — nav + live */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
          <div className="flex items-center gap-1 justify-start">
            {navLink('/', 'Team Tasks', 'Assign ad-hoc tasks to team members')}
            {navLink('/dashboard', 'Pipeline', 'Watch inventory & pipeline tasks')}
          </div>

          <Link
            href="/dashboard"
            className="font-luxury text-2xl lg:text-[1.75rem] text-ink text-center leading-none hover:text-accent transition-colors"
          >
            Purosangue QC Dashboard
          </Link>

          <div className="flex items-center gap-1 justify-end">
            {navLink('/history', 'History', 'Completed task history')}
            {navLink('/settings', 'Settings', 'Integrations & team')}
            <div className="ml-2">{liveBadge}</div>
          </div>
        </div>

        {/* Mobile: title centered, then nav row */}
        <div className="sm:hidden flex flex-col items-center gap-3">
          <div className="flex items-center justify-between w-full">
            <div className="w-14" />
            <Link
              href="/dashboard"
              className="font-luxury text-xl text-ink text-center leading-tight hover:text-accent transition-colors px-2"
            >
              Purosangue QC Dashboard
            </Link>
            {liveBadge}
          </div>
          <div className="flex items-center gap-0.5 flex-wrap justify-center">
            {navLink('/', 'Team Tasks', 'Assign ad-hoc tasks to team members')}
            {navLink('/dashboard', 'Pipeline', 'Watch inventory & pipeline tasks')}
            {navLink('/history', 'History', 'Completed task history')}
            {navLink('/settings', 'Settings', 'Integrations & team')}
          </div>
        </div>
      </div>
    </nav>
  )
}
