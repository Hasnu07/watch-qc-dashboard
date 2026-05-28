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
        ink: '#2c2c2c',
        muted: '#6b6560',
        border: 'rgba(44, 44, 44, 0.14)',
        surface: '#f2f0e4',
        panel: '#ebe7d9',
        card: '#faf8f3',
        accent: {
          DEFAULT: '#d9774b',
          dark: '#c4663d',
          light: '#e8956f',
        },
        sand: '#f2e394',
        buy: '#5c5348',
        sell: '#d9774b',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Syne', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
export default config
