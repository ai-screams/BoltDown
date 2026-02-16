/** @type {import('tailwindcss').Config} */
const withAlpha = cssVar => `rgb(var(${cssVar}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Semantic surfaces (bg-surface, bg-surface-canvas, …) ──
        surface: {
          canvas: withAlpha('--s-bg-canvas'),
          DEFAULT: withAlpha('--s-bg-surface'),
          elevated: withAlpha('--s-bg-elevated'),
          muted: withAlpha('--s-bg-muted'),
        },

        // ── Foreground (text-fg, text-fg-secondary, text-fg-muted) ──
        fg: {
          DEFAULT: withAlpha('--s-text-primary'),
          secondary: withAlpha('--s-text-secondary'),
          muted: withAlpha('--s-text-muted'),
        },

        // ── Borders (border-line, border-line-strong) ──
        line: {
          DEFAULT: withAlpha('--s-border-default'),
          strong: withAlpha('--s-border-strong'),
        },

        // ── Accent & status ──
        accent: {
          DEFAULT: withAlpha('--s-accent'),
          strong: withAlpha('--s-accent-strong'),
        },
        info: withAlpha('--s-info'),
        danger: withAlpha('--s-danger'),
        success: withAlpha('--s-success'),
        warning: withAlpha('--s-warning'),
        link: {
          DEFAULT: withAlpha('--s-link'),
          hover: withAlpha('--s-link-hover'),
        },

        // ── Legacy brand aliases ──
        brand: {
          accent: withAlpha('--color-brand-accent'),
          'accent-strong': withAlpha('--color-brand-accent-strong'),
          primary: withAlpha('--color-brand-primary'),
          info: withAlpha('--color-brand-info'),
          success: withAlpha('--color-brand-success'),
        },

        // ── Backward compatible named colors ──
        electric: {
          yellow: withAlpha('--color-electric-yellow'),
          dark: withAlpha('--color-electric-dark'),
        },
        deep: {
          blue: withAlpha('--color-deep-blue'),
          navy: withAlpha('--color-deep-navy'),
        },
        thunder: {
          gray: withAlpha('--color-thunder-gray'),
        },
        volt: {
          orange: withAlpha('--color-volt-orange'),
        },
        ion: {
          purple: withAlpha('--color-ion-purple'),
        },
        charge: {
          green: withAlpha('--color-charge-green'),
        },
      },
      fontFamily: {
        sans: ['Inter', 'Pretendard', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'monospace'],
      },
      animation: {
        bolt: 'bolt 0.3s ease-in-out',
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
