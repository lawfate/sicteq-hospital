import colors from 'tailwindcss/colors';

// Tema oscuro operativo. Las pantallas rediseñadas usan los tokens semánticos
// (background, card, primary, ok, warn, danger...) definidos en src/index.css.
// Las que todavía usan colores sueltos (bg-white, text-slate-800, bg-emerald-50)
// quedan legibles en oscuro porque cada escala se invierte: 50 <-> 950, 100 <-> 900...
// shortcut: inversión automática, no diseño; al rediseñar cada pantalla se pasa a tokens.
const PASOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const invertir = (escala) =>
  Object.fromEntries(PASOS.map((p, i) => [p, escala[PASOS[PASOS.length - 1 - i]]]));
const PALETAS = ['slate', 'gray', 'sky', 'blue', 'red', 'rose', 'emerald', 'green', 'amber', 'yellow', 'purple', 'indigo', 'orange', 'teal', 'cyan'];

const token = (nombre) => `hsl(var(--${nombre}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    { pattern: /bg-(blue|emerald|amber|purple|red|sky|indigo)-(50|100)/ },
    { pattern: /text-(blue|emerald|amber|purple|red|sky|indigo)-(400|500|600|700|800)/ },
    { pattern: /border-(blue|emerald|amber|purple|red|sky|indigo)-(100|200)/ },
  ],
  theme: {
    extend: {
      colors: {
        ...Object.fromEntries(PALETAS.map((n) => [n, invertir(colors[n])])),
        white: token('card'),
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
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible"', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      borderRadius: { lg: '10px', md: '8px', sm: '6px' },
    },
  },
  plugins: [],
}
