import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// GitHub Pages serves this project at https://<user>.github.io/kanban/, so the
// base path is the repo name. It is set unconditionally so that `vite dev` and
// `vite preview` serve the app under /kanban/ too, matching production.
export default defineConfig({
  plugins: [react()],
  base: '/kanban/',
})
