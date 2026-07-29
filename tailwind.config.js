/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Night mode is opt-in via <html data-theme="night">, set by the theme toggle
  darkMode: ['selector', '[data-theme="night"]'],
  theme: {
    extend: {
      colors: {
        // Both ramps flip with the theme — see the :root blocks in index.css
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          4: 'var(--surface-4)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
          faint: 'var(--ink-faint)',
          ghost: 'var(--ink-ghost)',
        },
        line: {
          DEFAULT: 'var(--line)',
          soft: 'var(--line-soft)',
        },
        accent: {
          blue: '#3b82f6',
          indigo: '#6366f1',
        },
      },
    },
  },
  plugins: [],
}
