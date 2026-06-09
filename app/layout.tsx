import type { Metadata, Viewport } from 'next'
import { Luxurious_Script } from 'next/font/google'
import './globals.css'
import NavBar from '@/components/NavBar'
import { SseProvider } from '@/components/SseProvider'
import { SoundProvider } from '@/components/SoundProvider'
import ErrorBoundary from '@/components/ErrorBoundary'

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
    <html lang="en" className={luxuriousScript.variable} suppressHydrationWarning>
      {/* suppressHydrationWarning on body: browser extensions (translators,
          password managers, "AI assistant" injectors, etc.) add attributes/nodes
          to <body> before React hydrates. Without this, React 18 production
          throws a fatal client exception and blanks the whole app. */}
      <body className="bg-surface text-ink min-h-screen flex flex-col" suppressHydrationWarning>
        <SseProvider>
          <SoundProvider>
            <NavBar />
            {/* App-wide error boundary: a crash on any page (including
                extension-induced hydration glitches) shows a Reload/Try-again
                UI instead of Next's raw white-on-navy "Application error". */}
            <ErrorBoundary>
              <main className="flex-1 flex flex-col">{children}</main>
            </ErrorBoundary>
          </SoundProvider>
        </SseProvider>
      </body>
    </html>
  )
}
