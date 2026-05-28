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
        className={`px-3 py-1 text-sm font-medium tracking-wide transition-colors ${
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

  return (
    <nav className="sticky top-0 z-50 bg-surface/95 backdrop-blur-sm border-b border-default">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-4">
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          <div className="flex items-center justify-between w-full">
            <div className="w-20 sm:hidden" />
            <Link href="/dashboard" className="font-display text-lg sm:text-xl font-bold tracking-[0.18em] text-ink uppercase text-center leading-tight">
              Watch QC
            </Link>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${
              connected ? 'border-accent/40 text-accent bg-accent/5' : 'border-default text-muted bg-card'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-accent live-dot' : 'bg-muted'}`} />
              <span className="hidden sm:inline">{connected ? 'Live' : 'Poll'}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 flex-wrap justify-center">
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
