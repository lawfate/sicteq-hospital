import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Alias "@/..." = src/, la convención de los componentes shadcn/ui.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
