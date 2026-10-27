import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import assert from 'node:assert/strict';
import { openDb } from '../server/db';
import { asStore } from '../server/store';
import { initDispatcher } from '../server/seed';
import { createApp } from '../server/app';
import { fleetContract } from './fleet-contract';

fleetContract('SQLite', async () => {
  const raw = openDb(':memory:');
  await initDispatcher(raw, 'dispecer', 'ProductionTest!2026');
  const db = asStore(raw);
  const app = await createApp(db, { origin: 'http://localhost:5173' });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = (path: string, body?: unknown, cookie = '', csrf = '', method?: string) =>
    fetch(base + path, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: {
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-CSRF-Token': csrf,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const login = async (username = 'dispecer', password = 'ProductionTest!2026') => {
    const response = await call('/api/auth/login', { username, password });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    const data = (await (await call('/api/bootstrap', undefined, cookie)).json()) as {
      csrfToken: string;
      user: { id: string; version: number };
    };
    return { cookie, csrf: data.csrfToken, data };
  };
  return {
    db,
    call,
    login,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    },
  };
});
