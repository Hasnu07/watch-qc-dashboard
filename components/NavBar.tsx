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
        className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all sm:px-4 sm:py-2 ${
          active
            ? 'bg-white/15 text-white border border-white/25 shadow-[0_0_18px_rgba(255,255,255,0.08)] backdrop-blur-sm'
            : 'text-white/45 hover:text-white/80 hover:bg-white/8 border border-transparent'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <nav className="glass-strong sticky top-0 z-50 border-b border-white/10 shadow-[0_4px_40px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between px-4 py-3 sm:px-8 sm:py-3.5">

        {/* Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 flex items-center justify-center text-white font-black text-sm shadow-[0_0_24px_rgba(0,212,255,0.35)] sm:w-9 sm:h-9 sm:text-base">
            W
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-black tracking-tight text-gradient-cyan sm:text-lg">Watch QC</span>
            <span className="hidden sm:block text-[10px] text-white/30 font-medium tracking-widest uppercase">Dashboard</span>
          </div>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {navLink('/', 'Admin Tasks')}
          {navLink('/dashboard', 'Dashboard')}
          {navLink('/history', 'History')}
          {navLink('/settings', 'Settings')}
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5">
          <span className="live-dot w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          <span className="hidden sm:inline text-white/35 text-xs font-semibold tracking-widest uppercase">Live</span>
        </div>

      </div>
    </nav>
  )
}
