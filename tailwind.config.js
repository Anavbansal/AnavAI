/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ["'DM Sans'", 'system-ui', 'sans-serif'],
        mono:    ["'DM Mono'", 'monospace'],
        display: ["'Syne'", 'sans-serif'],
      },
      colors: {
        bg:      '#07090f',
        bg2:     '#0d1117',
        bg3:     '#111827',
        surface: '#161d2b',
        sf2:     '#1c2438',
        border:  '#1e2d42',
        bd2:     '#28405e',
        accent:  '#5865f2',
        green:   '#22c55e',
        red:     '#f43f5e',
        amber:   '#f59e0b',
        blue:    '#38bdf8',
        purple:  '#a78bfa',
        text:    '#e2e8f0',
        text2:   '#94a3b8',
        dim:     '#4b6082',
      },
    },
  },
  plugins: [],
}
