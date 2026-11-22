// Ambas apariencias usan los mismos tokens definidos en index.css.
const token = (nombre) => `hsl(var(--${nombre}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        card: { DEFAULT: token('card'), foreground: token('foreground') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        border: token('border'),
        input: token('border'),
        ring: token('primary'),
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
        secondary: { DEFAULT: token('muted'), foreground: token('foreground') },
        destructive: { DEFAULT: token('danger'), foreground: token('primary-foreground') },
        ok: token('ok'),
        warn: token('warn'),
        danger: token('danger'),
        accent: token('accent'),
        lavender: token('lavender'),
        navigation: { DEFAULT: token('navigation'), foreground: token('navigation-foreground') },
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible"', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      borderRadius: { lg: '20px', md: '12px', sm: '8px' },
      boxShadow: {
        card: '0 5px 24px -8px hsl(var(--shadow) / 0.14)',
        soft: '0 12px 40px -16px hsl(var(--shadow) / 0.2)',
      },
    },
  },
  plugins: [],
}
