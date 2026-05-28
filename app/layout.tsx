import type { Metadata, Viewport } from 'next'
import './globals.css'
import NavBar from '@/components/NavBar'
import { SseProvider } from '@/components/SseProvider'

export const metadata: Metadata = {
  title: 'QC Dashboard — Watch Trading',
  description: 'Quality Control Dashboard for Watch Trading Business',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'Watch QC' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-surface text-ink min-h-screen flex flex-col">
        <SseProvider>
          <NavBar />
          <main className="flex-1 flex flex-col">{children}</main>
        </SseProvider>
      </body>
    </html>
  )
}
