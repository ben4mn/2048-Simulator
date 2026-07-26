# 2048 Simulator — Backend API Contract (v1)

Single Express server serves the built SPA from `dist/` and the API under `/api`.
Listens on `PORT` (default 3000). SQLite database file lives in `DATA_DIR` (default `/data`).
Auth via httpOnly `session` cookie (JWT, 30-day expiry, SameSite=Lax, Secure behind TLS).
All request/response bodies are JSON. Errors: `{ "error": string }` with appropriate status.

## Auth

### POST /api/auth/register
Body: `{ username, password }`. Username: 3–32 chars, `[a-z0-9_-]`, case-insensitive unique.
Password: min 8 chars. → `201 { user }` + session cookie. `409` if taken.

### POST /api/auth/login
Body: `{ username, password }` → `200 { user }` + cookie. `401` on bad credentials.
Rate-limited (see below).

### POST /api/auth/logout
→ `204`, clears cookie.

### GET /api/auth/me
→ `200 { user }` or `401`.

`user` shape: `{ id, username, isAdmin: boolean, keys: { anthropic: boolean, openai: boolean } }`
(`keys` = whether a key is stored for that provider; admin's `anthropic` is true when the
server env key is configured. Key VALUES are never returned by any endpoint.)

## API keys (own compute for non-admin users)

### PUT /api/account/api-key
Auth required. Body: `{ provider: "anthropic" | "openai", apiKey: string }`.
Stored encrypted (AES-256-GCM, `KEY_ENCRYPTION_SECRET`). → `204`.
Basic prefix sanity check (`sk-ant-` / `sk-`) → `400` on mismatch.

### DELETE /api/account/api-key
Auth required. Body: `{ provider }` → `204`.

## AI proxy

### POST /api/ai/generate-strategy
Auth required. Body: `{ description: string (1–2000 chars), provider?: "anthropic" | "openai", model?: string }`.
Key resolution: admin user → server env `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`;
other users → their stored key for the provider; `400 { error: "No API key configured..." }` if none.
Server builds the request itself using `shared/aiPrompt.ts` SYSTEM_PROMPT (clients cannot
override the prompt), calls the provider with `max_tokens` capped at 2000, default models
`claude-sonnet-5` / `gpt-5-mini`, and returns `200 { content: string }` — the raw model text.
The CLIENT keeps doing JSON extraction + rule validation (existing tested code path).
Provider errors surface as `502 { error }` with a readable message; model-retired hint on 404.

## Rate limits
- `/api/auth/login` + `/api/auth/register`: 20 requests / 15 min per IP → `429`.
- `/api/ai/generate-strategy`: 10 / hour per user (any provider) → `429 { error }`.

## Environment (.env)
```
PORT=3000
DATA_DIR=/data
JWT_SECRET=<random 32+ bytes>
KEY_ENCRYPTION_SECRET=<random 32+ bytes>
ADMIN_USERNAME=ben
ADMIN_PASSWORD=<set by Ben — account is (re)seeded to match on boot>
ANTHROPIC_API_KEY=<Ben's key, used ONLY for the admin user>
OPENAI_API_KEY=<optional>
```

## Frontend integration notes
- Dev: Vite proxies `/api` → `http://localhost:3000` (configured in vite.config.ts).
- All fetches use `credentials: 'include'`.
- `src/services/authApi.ts` wraps these endpoints; a small auth store holds `user`.
- AIStrategyGenerator gains a server mode: logged in → POST /api/ai/generate-strategy
  and parse `content` with the existing extraction/validation; logged out → legacy
  browser-key mode still works (with the existing sessionStorage warning).
