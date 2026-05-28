import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#171c25',
        muted: '#777587',
        border: '#c7c4d8',
        surface: '#f9f9ff',
        panel: '#f0f3ff',
        buy: '#4f46e5',
        sell: '#f97316',
        bg: {
          primary: '#0a0a0f',
          secondary: '#111118',
          card: '#16161f',
          hover: '#1e1e2a',
        },
        accent: {
          blue: '#3b82f6',
          green: '#22c55e',
          yellow: '#eab308',
          red: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
