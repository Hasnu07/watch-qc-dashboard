'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavBar() {
  const pathname = usePathname()

  const navLink = (href: string, label: string) => {
    const active = pathname === href
    return (
      <Link
        href={href}
        className={`px-5 py-2 rounded-lg text-base font-semibold transition-all ${
          active
            ? 'bg-white text-indigo-700 shadow-sm'
            : 'text-slate-300 hover:text-white hover:bg-white/10'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <nav className="flex items-center justify-between px-8 py-3.5 bg-slate-900 border-b border-slate-700 sticky top-0 z-50 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-black text-lg shadow-inner">
          W
        </div>
        <div>
          <span className="text-xl font-black text-white tracking-tight">Watch QC</span>
          <span className="ml-2 text-xs text-slate-400 font-medium">Dashboard</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {navLink('/', 'Dashboard')}
        {navLink('/history', 'History')}
        {navLink('/settings', 'Settings')}
      </div>

      <div className="flex items-center gap-2">
        <span className="live-dot w-2 h-2 rounded-full bg-emerald-400 inline-block" />
        <span className="text-slate-300 text-sm font-medium">Live</span>
      </div>
    </nav>
  )
}
