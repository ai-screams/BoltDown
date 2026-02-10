/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // BoltDown Brand Colors
        electric: {
          yellow: '#FACC15',
          dark: '#CA8A04',
        },
        deep: {
          blue: '#1E3A8A',
          navy: '#1E293B',
        },
        thunder: {
          gray: '#64748B',
        },
        volt: {
          orange: '#F97316',
        },
        ion: {
          purple: '#7C3AED',
        },
        charge: {
          green: '#10B981',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Pretendard', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'monospace'],
      },
      animation: {
        'bolt': 'bolt 0.3s ease-in-out',
      },
      keyframes: {
        bolt: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [],
}
