/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Share Tech Mono"', 'monospace'],
        display: ['"Orbitron"', 'monospace'],
        body: ['"Rajdhani"', 'sans-serif'],
      },
      colors: {
        bg: '#040810',
        bg2: '#080f1a',
        bg3: '#0d1825',
        panel: '#0a1520',
        border: '#1a3050',
        accent: '#00d4ff',
        accent2: '#00ff88',
        accent3: '#ff6b35',
        danger: '#ff3366',
        success: '#00ff88',
        warning: '#ffd700',
        dim: '#3a5a7a',
        muted: '#6a9ab8',
      }
    }
  },
  plugins: []
}
