/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', '"Avenir Next"', 'Avenir', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SFMono-Regular"', 'Menlo', 'Monaco', 'monospace'],
      },
      colors: {
        app: {
          bg: 'var(--color-bg)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          muted: 'var(--color-text-muted)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          strong: 'var(--color-accent-strong)',
        },
        success: 'var(--color-success)',
        danger: 'var(--color-danger)',
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
          DEFAULT: 'var(--color-surface)',
          raised: 'var(--color-surface-raised)',
          elevated: 'var(--color-surface-elevated)',
          overlay: 'rgba(5, 7, 11, 0.7)',
        },
        dark: {
          bg: 'var(--color-bg)',
          border: 'var(--color-border)',
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
