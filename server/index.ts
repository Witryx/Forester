import { openDb } from './db.js';
import { createApp } from './app.js';
import { openPostgres } from './postgres.js';
const db = process.env.DATABASE_URL ? openPostgres(process.env.DATABASE_URL).store : openDb();
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const server = (await createApp(db)).listen(port, host, () =>
  console.log(`Forester API: http://${host}:${port}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
