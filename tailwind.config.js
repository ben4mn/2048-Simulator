/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tile: {
          2: '#eee4da',
          4: '#ede0c8',
          8: '#f2b179',
          16: '#f59563',
          32: '#f67c5f',
          64: '#f65e3b',
          128: '#edcf72',
          256: '#edcc61',
          512: '#edc850',
          1024: '#edc53f',
          2048: '#edc22e',
        },
        surface: {
          DEFAULT: '#1a1d28',
          raised: '#242836',
          overlay: 'rgba(0, 0, 0, 0.6)',
        },
        dark: {
          bg: '#0f1117',
          border: '#2d3348',
        },
      },
      animation: {
        'tile-appear': 'tile-appear 150ms ease-out',
        'tile-merge': 'tile-merge 200ms ease-out',
        'score-pop': 'score-pop 300ms ease-out',
        'shimmer': 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
}
