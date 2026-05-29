import type { Metadata, Viewport } from 'next'
import { Luxurious_Script } from 'next/font/google'
import './globals.css'
import NavBar from '@/components/NavBar'
import { SseProvider } from '@/components/SseProvider'

const luxuriousScript = Luxurious_Script({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-luxury',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Purosangue QC Dashboard',
  description: 'Quality Control Dashboard for Watch Trading Business',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'Purosangue QC' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={luxuriousScript.variable}>
      <body className="bg-surface text-ink min-h-screen flex flex-col">
        <SseProvider>
          <NavBar />
          <main className="flex-1 flex flex-col">{children}</main>
        </SseProvider>
      </body>
    </html>
  )
}
