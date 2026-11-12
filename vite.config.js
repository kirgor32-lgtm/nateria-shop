import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
// Сайт лежит на GitHub Pages по адресу /nateria-shop/ — нужен абсолютный base, т.к. страниц много и они вложенные
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  base: '/nateria-shop/',
  preview: { host: '127.0.0.1', allowedHosts: true },
})
