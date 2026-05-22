import type { Metadata } from 'next'
import './globals.css'
import NavBar from '@/components/NavBar'

export const metadata: Metadata = {
  title: 'QC Dashboard — Watch Trading',
  description: 'Quality Control Dashboard for Watch Trading Business',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0f] text-slate-100 min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  )
}
