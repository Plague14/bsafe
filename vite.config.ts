import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Served from the domain root on Vercel; the router follows import.meta.env.BASE_URL
  base: '/',
})
