import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // GitHub Pages serves this project from /DndCharactercreator/, so the
  // production build needs that base path baked into asset URLs. The dev
  // server keeps serving from the root.
  base: command === 'build' ? '/DndCharactercreator/' : '/',
}))
