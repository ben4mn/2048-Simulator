# 2048 Strategy Simulator

Live app: [2084.4mn.org](https://2084.4mn.org).

Play 2048, build your own strategies, and compare their performance in seeded simulations. The app uses React, TypeScript, Vite, Zustand, and a Node/Express backend with SQLite.

## Features

- Interactive games with keyboard and swipe controls.
- Built-in strategies and a custom strategy builder with evaluation rules.
- Background batch simulations, progress tracking, results, and game replays.
- Reproducible games using seeds and locally saved strategies and results.
- Optional accounts and AI strategy assistance with encrypted provider keys.
- An installable PWA with offline access to the simulator after loading it once.

## Local development

Use **Node.js 22.12 or newer** and npm. Node 20 is unsupported by the current SQLite and testing dependencies.

```bash
npm ci
npm run server:dev
```

In a second terminal:

```bash
npm run dev
```

Open `http://localhost:5173`. Vite forwards `/api` requests to the backend on port 3000. Local server data defaults to `./data`; development secrets are generated automatically if unset. To keep sessions and stored API keys across restarts, pass stable secrets through the server environment.

Validate changes with:

```bash
npm run lint
npm test
npm run build
npm run server:build
```

## Container deployment

Copy `.env.example` to `.env`. Set `JWT_SECRET` and `KEY_ENCRYPTION_SECRET` to separate values of at least 32 characters; `openssl rand -hex 32` generates a suitable value. Keep both secrets stable across deployments. Set admin credentials and provider keys if needed.

```bash
docker compose up -d --build app
```

The container serves the frontend and API at `http://localhost:3048`. SQLite data persists in `./data`, mounted at `/data` inside the container. To update an existing checkout:

```bash
git pull --ff-only origin main
docker compose build app
docker compose up -d --no-deps app
docker compose logs --tail 30 app
```

The production hostname is routed by the Debian server’s `debian-sites` Cloudflare tunnel to `http://localhost:3048`. Hostname changes only require updating that tunnel ingress and DNS; the app container and its persistent account database stay in place.

## GitHub Pages

Pushes to `main` run lint, tests, frontend and server compilation, and deploy the frontend through `.github/workflows/deploy-pages.yml`. Set repository **Settings → Pages → Source** to **GitHub Actions**. The build uses the repository name as its base path.

GitHub Pages hosts the simulator as a static app. Accounts and AI assistance require the Node backend provided by the container deployment.

## License

MIT
