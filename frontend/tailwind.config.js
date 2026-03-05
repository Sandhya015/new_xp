/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#0f172a',
        },
        brand: {
          navy: '#1E3A5F',
          blue: '#1e40af',
          accent: '#2563EB',
          'light-bg': '#EFF6FF',
        },
        slate: { gray: '#6B7280' },
        success: { green: '#16A34A' },
        warning: { orange: '#EA580C' },
        error: { red: '#DC2626' },
        violet: { 500: '#7C3AED' },
        teal: { 600: '#059669' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
