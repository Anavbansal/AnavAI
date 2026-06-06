/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        bg:      '#0b0f19',
        bg2:     '#111827',
        card:    '#151c2c',
        hover:   '#1a2235',
        border:  '#1f2d45',
        borderB: '#2a3f5f',
        accent:  '#6366f1',
        green:   '#10b981',
        red:     '#ef4444',
        yellow:  '#f59e0b',
        blue:    '#3b82f6',
        text1:   '#f1f5f9',
        text2:   '#94a3b8',
        dim:     '#475569',
      }
    }
  },
  plugins: []
}
