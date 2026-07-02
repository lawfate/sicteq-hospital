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
    extend: {},
  },
  plugins: [],
}