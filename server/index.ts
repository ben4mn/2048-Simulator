/**
 * Server entry point. Validates configuration (refusing to start in
 * production without proper secrets), seeds the admin user, and listens.
 */
import { loadConfig } from './config.js';
import { createApp } from './app.js';

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(
    `[2048-simulator] Refusing to start: ${error instanceof Error ? error.message : error}`
  );
  process.exit(1);
}

const { app, db } = createApp(config);

const server = app.listen(config.port, () => {
  console.log(
    `[2048-simulator] Listening on http://localhost:${config.port} ` +
      `(env: ${config.isProduction ? 'production' : 'development'}, data: ${config.dataDir})`
  );
});

function shutdown(signal: string): void {
  console.log(`[2048-simulator] ${signal} received, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
