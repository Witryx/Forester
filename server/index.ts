import { openDb } from './db';
import { createApp } from './app';
const db = openDb();
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const server = createApp(db).listen(port, host, () =>
  console.log(`Forester API: http://${host}:${port}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
