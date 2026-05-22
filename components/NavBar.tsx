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
        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all sm:px-5 sm:py-2 sm:text-base ${
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
    <nav className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-700 sticky top-0 z-50 shadow-lg sm:px-8 sm:py-3.5">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-black text-base shadow-inner sm:w-9 sm:h-9 sm:text-lg">
          W
        </div>
        <div>
          <span className="text-lg font-black text-white tracking-tight sm:text-xl">Watch QC</span>
          <span className="hidden sm:inline ml-2 text-xs text-slate-400 font-medium">Dashboard</span>
        </div>
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1">
        {navLink('/', 'Dashboard')}
        {navLink('/admin-tasks', 'Tasks')}
        {navLink('/history', 'History')}
        {navLink('/settings', 'Settings')}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="live-dot w-2 h-2 rounded-full bg-emerald-400 inline-block" />
        <span className="hidden sm:inline text-slate-300 text-sm font-medium">Live</span>
      </div>
    </nav>
  )
}
