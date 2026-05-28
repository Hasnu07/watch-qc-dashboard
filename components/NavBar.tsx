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
        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all tracking-wide ${
          active
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-white/10'
        }`}
        title={subtitle}
      >
        {label}
      </Link>
    )
  }

  return (
    <nav className="sticky top-0 z-50 bg-[#2c313a] border-b border-white/10 shadow-md">
      <div className="flex items-center justify-between px-4 py-3 max-w-screen-2xl mx-auto sm:px-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
            W
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-black text-white tracking-tight sm:text-lg">Watch QC</span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          {navLink('/', 'Team Tasks', 'Assign ad-hoc tasks to team members')}
          {navLink('/dashboard', 'Pipeline', 'Watch inventory & pipeline tasks')}
          {navLink('/history', 'History', 'Completed task history')}
          {navLink('/settings', 'Settings', 'Integrations & team')}
        </div>

        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-bold ${
          connected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        }`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 live-dot' : 'bg-amber-400'}`} />
          <span className="hidden sm:inline">{connected ? 'Live' : 'Polling'}</span>
        </div>
      </div>
    </nav>
  )
}
