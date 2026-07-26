# ---- Stage 1: build frontend + server (and compile better-sqlite3) ----------
# NOTE: node 22, not 20 — better-sqlite3 v13 declares engines.node >= 22 and
# segfaults under node 20 on alpine.
FROM node:22-alpine AS build
WORKDIR /app

# better-sqlite3 is a native module; it needs a toolchain to compile on alpine.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Frontend → dist/, server (TypeScript → plain JS) → dist-server/
RUN npm run build && npm run server:build

# Drop devDependencies; the compiled better-sqlite3 binding survives the prune.
RUN npm prune --omit=dev

# ---- Stage 2: runtime --------------------------------------------------------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/package.json ./package.json

VOLUME /data
EXPOSE 3000

CMD ["node", "dist-server/server/index.js"]
