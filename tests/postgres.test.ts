import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { postgresStore, postgresParameters, type ConnectionPool } from '../server/store';
import { migratePostgres, initPostgresDispatcher } from '../server/postgres';
import { createApp } from '../server/app';
import { createVercelHandler, restoreApiUrl } from '../server/vercel-handler';
import { qualifyPostgresTables } from '../server/postgres-schema';
import { fleetContract } from './fleet-contract';

// A real PostgreSQL engine in WASM. One test connection is serialized because PGlite has one session.
async function fixture(beforeMigration?: string) {
  const pg = new PGlite();
  if (beforeMigration) await pg.exec(beforeMigration);
  let tail = Promise.resolve();
  async function acquire() {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    return release;
  }
  async function query(sql: string, values?: unknown[]) {
    const result = values?.length
      ? await pg.query<Record<string, unknown>>(sql, values)
      : (await pg.exec(sql)).at(-1)!;
    return { rows: result.rows as Record<string, unknown>[], rowCount: result.affectedRows ?? 0 };
  }
  const pool: ConnectionPool = {
    async query(sql, values) {
      const release = await acquire();
      try {
        return await query(sql, values);
      } finally {
        release();
      }
    },
    async connect() {
      const release = await acquire();
      return { query, release };
    },
    end: () => pg.close(),
  };
  await migratePostgres(pool);
  const db = postgresStore(pool);
  return { db, pool };
}

async function httpFixture() {
  const { db, pool } = await fixture();
  await initPostgresDispatcher(db, 'dispecer', 'ProductionTest!2026');
  const app = await createApp(db, { origin: 'https://forester.example', production: true });
  const server = createServer(createVercelHandler(async () => app)).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function call(path: string, body?: unknown, cookie = '', csrf = '', method?: string) {
    const rewrittenPath = '/api?__foresterPath=' + encodeURIComponent(path.slice('/api/'.length));
    return fetch(base + rewrittenPath, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: {
        Origin: 'https://forester.example',
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-CSRF-Token': csrf,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function login(username = 'dispecer', password = 'ProductionTest!2026') {
    const response = await call('/api/auth/login', { username, password });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie')!, /Secure/);
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    const bootstrap = await call('/api/bootstrap', undefined, cookie);
    const data = (await bootstrap.json()) as {
      user: { id: string; version: number };
      csrfToken: string;
      employees: unknown[];
    };
    return { cookie, csrf: data.csrfToken, data };
  }
  return {
    db,
    pool,
    app,
    call,
    login,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
      await db.close();
    },
  };
}

fleetContract('PostgreSQL', httpFixture);

test('PostgreSQL: migrace a první účet jsou opakovatelné, audit zůstává neměnný', async () => {
  const { db, pool } = await fixture();
  try {
    await migratePostgres(pool);
    assert.equal(await initPostgresDispatcher(db, 'dispecer', 'ProductionTest!2026'), true);
    assert.equal(await initPostgresDispatcher(db, 'jiny', 'DifferentTest!2026'), false);
    assert.equal(Number((await db.prepare('SELECT COUNT(*) AS n FROM users').get())!.n), 1);
    assert.equal(
      Number((await db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get())!.n),
      2,
    );
    await assert.rejects(
      () => db.prepare("UPDATE audit_events SET action='changed'").run(),
      /audit_immutable/,
    );
    await assert.rejects(() => db.prepare('DELETE FROM audit_events').run(), /audit_immutable/);
    assert.equal(
      postgresParameters("SELECT '?' AS literal, ? AS value"),
      "SELECT '?' AS literal, $1 AS value",
    );
    assert.equal(restoreApiUrl('/api?__foresterPath=auth%2Flogin&x=1'), '/api/auth/login?x=1');
    assert.equal(restoreApiUrl('/api/users?x=1'), '/api/users?x=1');
  } finally {
    await db.close();
  }
});

test('PostgreSQL: cizí users a schema_migrations nezablokují Forester a zůstanou nezměněné', async () => {
  const { db, pool } = await fixture(`
    CREATE TABLE public.schema_migrations (version TEXT PRIMARY KEY);
    INSERT INTO public.schema_migrations VALUES ('other-app-001');
    CREATE TABLE public.users (id TEXT PRIMARY KEY, email TEXT NOT NULL);
    INSERT INTO public.users VALUES ('original-user','original@example.test');
    CREATE TABLE public.settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
    INSERT INTO public.settings VALUES ('demo','true');
  `);
  try {
    const client = await pool.connect();
    try {
      await assert.rejects(
        () =>
          client.query('SELECT name FROM public.schema_migrations WHERE name=$1', [
            '001-foundation.sql',
          ]),
        (error: unknown) =>
          (error as { code: string; position: string }).code === '42703' &&
          (error as { position: string }).position === '8',
      );
    } finally {
      client.release();
    }
    await migratePostgres(pool);
    assert.equal(await initPostgresDispatcher(db, 'dispecer', 'ProductionTest!2026'), true);
    assert.equal((await db.prepare('SELECT username FROM users').get())!.username, 'dispecer');
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get())!.n, 2);
    assert.deepEqual(await db.prepare('SELECT * FROM public.schema_migrations').all(), [
      { version: 'other-app-001' },
    ]);
    assert.deepEqual(await db.prepare('SELECT * FROM public.users').all(), [
      { id: 'original-user', email: 'original@example.test' },
    ]);
    await createApp(db, { production: true, origin: 'https://forester.example' });
    assert.equal(
      (await db.prepare("SELECT value_json FROM public.settings WHERE key='demo'").get())!
        .value_json,
      'true',
    );
    assert.equal(
      qualifyPostgresTables("SELECT 'FROM users' FROM users -- JOIN users\n"),
      "SELECT 'FROM users' FROM forester.users -- JOIN users\n",
    );
    assert.equal(qualifyPostgresTables('SELECT * FROM public.users'), 'SELECT * FROM public.users');
  } finally {
    await db.close();
  }
});

test('PostgreSQL: přihlášení, souběžné vytvoření řidičů, rollback a role', async () => {
  const f = await httpFixture();
  try {
    const a = await f.login();
    const body = {
      username: 'jana.nova',
      displayName: 'Jana Nová',
      role: 'driver',
      employeeId: null,
      newEmployee: { firstName: 'Jana', lastName: 'Nová' },
      password: 'TemporaryTest!2026',
    };
    const responses = await Promise.all([
      f.call('/api/users', body, a.cookie, a.csrf),
      f.call('/api/users', { ...body, username: 'jana.druha' }, a.cookie, a.csrf),
    ]);
    for (const response of responses) assert.equal(response.status, 201, await response.text());
    const profiles = await f.db.prepare('SELECT code FROM employees ORDER BY code').all();
    assert.deepEqual(
      profiles.map((e) => e.code),
      ['ZAM-001', 'ZAM-002'],
    );
    const before = Number((await f.db.prepare('SELECT COUNT(*) AS n FROM audit_events').get())!.n);
    assert.equal((await f.call('/api/users', body, a.cookie, a.csrf)).status, 409);
    assert.equal(Number((await f.db.prepare('SELECT COUNT(*) AS n FROM employees').get())!.n), 2);
    assert.equal(
      Number((await f.db.prepare('SELECT COUNT(*) AS n FROM audit_events').get())!.n),
      before,
    );
    const d = await f.login(body.username, body.password);
    assert.equal(d.data.employees.length, 0);
    assert.equal(
      (
        await f.call(
          '/api/auth/password',
          {
            currentPassword: body.password,
            newPassword: 'PersonalTest!2026',
          },
          d.cookie,
          d.csrf,
        )
      ).status,
      200,
    );
    assert.equal((await f.call('/api/bootstrap', undefined, d.cookie)).status, 401);
    const changed = await f.login(body.username, 'PersonalTest!2026');
    assert.equal((await f.call('/api/users', undefined, changed.cookie)).status, 403);
    assert.equal((await f.call('/api/users', body, changed.cookie, changed.csrf)).status, 403);
    assert.equal(
      (
        await f.call(
          `/api/users/${changed.data.user.id}/reset-password`,
          {
            password: 'ResetPassword!2026',
            version: changed.data.user.version,
          },
          a.cookie,
          a.csrf,
        )
      ).status,
      200,
    );
    assert.equal((await f.call('/api/bootstrap', undefined, changed.cookie)).status, 401);
    const reset = await f.login(body.username, 'ResetPassword!2026');
    assert.equal((await f.call('/api/users', undefined, reset.cookie)).status, 403);
    const rows = await f.db.prepare('SELECT * FROM audit_events').all();
    assert(!JSON.stringify(rows).includes(body.password));
    assert(!JSON.stringify(rows).includes('scrypt:'));
  } finally {
    await f.close();
  }
});

test('PostgreSQL: deaktivace zneplatní session a poslední dispečer zůstane zachovaný', async () => {
  const f = await httpFixture();
  try {
    const a = await f.login();
    const edit = {
      username: 'dispecer',
      displayName: 'Dispečer',
      role: 'dispatcher',
      employeeId: null,
      version: 1,
      active: false,
    };
    assert.equal(
      (await f.call(`/api/users/${a.data.user.id}`, edit, a.cookie, a.csrf, 'PATCH')).status,
      422,
    );
    const create = await f.call(
      '/api/users',
      {
        username: 'druhy',
        displayName: 'Druhý dispečer',
        role: 'dispatcher',
        employeeId: null,
        password: 'TemporaryTest!2026',
      },
      a.cookie,
      a.csrf,
    );
    assert.equal(create.status, 201);
    assert.equal(
      (await f.call(`/api/users/${a.data.user.id}`, edit, a.cookie, a.csrf, 'PATCH')).status,
      200,
    );
    assert.equal((await f.call('/api/bootstrap', undefined, a.cookie)).status, 401);
    assert.equal(
      (await f.call('/api/auth/login', { username: 'dispecer', password: 'ProductionTest!2026' }))
        .status,
      401,
    );
  } finally {
    await f.close();
  }
});

test('PostgreSQL: session a omezení přihlášení jsou sdílené mezi instancemi serveru', async () => {
  const f = await httpFixture();
  let second: ReturnType<Awaited<ReturnType<typeof createApp>>['listen']> | undefined;
  try {
    const a = await f.login();
    const app = await createApp(f.db, { origin: 'https://forester.example', production: true });
    second = app.listen(0, '127.0.0.1');
    await once(second, 'listening');
    const bootstrap = await fetch(
      `http://127.0.0.1:${(second.address() as AddressInfo).port}/api/bootstrap`,
      {
        headers: { Cookie: a.cookie },
      },
    );
    assert.equal(bootstrap.status, 200);
    assert.equal(((await bootstrap.json()) as { user: { id: string } }).user.id, a.data.user.id);
    for (let i = 0; i < 10; i++) {
      assert.equal(
        (await f.call('/api/auth/login', { username: 'unknown', password: 'wrong' })).status,
        401,
      );
    }
    const response = await fetch(
      `http://127.0.0.1:${(second.address() as AddressInfo).port}/api/auth/login`,
      {
        method: 'POST',
        headers: { Origin: 'https://forester.example', 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'unknown', password: 'wrong' }),
      },
    );
    assert.equal(response.status, 429);
  } finally {
    if (second) {
      second.closeAllConnections();
      await new Promise<void>((r) => second!.close(() => r()));
    }
    await f.close();
  }
});
