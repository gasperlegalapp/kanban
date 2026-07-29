/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cream ramp — near-white with a very slight red hue
        surface: {
          0: '#fdfaf9',
          1: '#fffcfb',
          2: '#fdf8f7',
          3: '#f8efec',
          4: '#f2e4e0',
        },
        // Warm neutrals for text on cream surfaces
        ink: {
          DEFAULT: '#2a211f',
          muted: '#6b5a55',
          faint: '#9b8983',
          ghost: '#bcaba5',
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
