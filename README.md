# 2048 Strategy Simulator

An experimental simulator designed to test and compare different approaches to playing 2048. Explore manual strategies, algorithmic approaches, and AI-driven gameplay to understand optimal decision-making in this classic puzzle game.

## Features

- Multiple strategy implementations
- Performance comparison between approaches
- Visual game state representation
- Configurable simulation parameters

## Tech Stack

React, TypeScript, Vite, Tailwind CSS, Zustand

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Running

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

## PWA

The app is configured as a Progressive Web App via `vite-plugin-pwa`:

- installable on supported browsers
- offline cache for built assets
- auto-updating service worker

## GitHub Pages Deployment

This repo includes `.github/workflows/deploy-pages.yml` to deploy automatically on pushes to `main`.

To enable hosting:

1. In GitHub, go to `Settings -> Pages`.
2. Set Source to `GitHub Actions`.
3. Push to `main`.

The workflow builds with a repo-aware base path so it works on Pages project URLs.

## License

MIT
