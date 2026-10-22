import { Pool, types } from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { postgresStore, type ConnectionPool, type Store, audit } from './store.js';
import { hashPassword } from './security.js';
import { randomUUID } from 'node:crypto';
import { DeploymentConfigError } from './deploy-errors.js';

export function openPostgres(connectionString: string) {
  if (!/^postgres(ql)?:\/\//.test(connectionString))
    throw new DeploymentConfigError('DATABASE_URL musí být připojení k PostgreSQL.');
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new DeploymentConfigError('DATABASE_URL nemá platný formát připojovací URL.');
  }
  // These aliases currently mean verify-full in pg 8. Make that explicit without
  // weakening certificate verification or changing explicitly requested libpq mode.
  if (
    ['prefer', 'require', 'verify-ca'].includes(url.searchParams.get('sslmode') ?? '') &&
    url.searchParams.get('uselibpqcompat') !== 'true'
  )
    url.searchParams.set('sslmode', 'verify-full');
  const pool = new Pool({
    connectionString: url.toString(),
    max: 3,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 15000,
    types: {
      getTypeParser(oid, format) {
        return oid === 20 && format !== 'binary' ? BigInt : types.getTypeParser(oid, format);
      },
    },
  });
  pool.on('error', () => console.error('PostgreSQL: spojení s databází bylo přerušeno.'));
  return { pool, store: postgresStore(pool as ConnectionPool) };
}

export async function migratePostgres(pool: ConnectionPool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(614327802)');
    await client.query('CREATE SCHEMA IF NOT EXISTS forester');
    // DDL is scoped to this transaction, including when the URL uses PgBouncer.
    await client.query('SET LOCAL search_path TO forester');
    await client.query(
      'CREATE TABLE IF NOT EXISTS forester.schema_migrations (name TEXT PRIMARY KEY, applied_at BIGINT NOT NULL)',
    );
    const folder = fileURLToPath(new URL('./postgres-migrations/', import.meta.url));
    for (const name of readdirSync(folder)
      .filter((n) => n.endsWith('.sql'))
      .sort()) {
      const applied = await client.query(
        'SELECT name FROM forester.schema_migrations WHERE name=$1',
        [name],
      );
      if (applied.rows.length) continue;
      await client.query(readFileSync(resolve(folder, name), 'utf8'));
      await client.query('INSERT INTO forester.schema_migrations VALUES ($1,$2)', [
        name,
        Date.now(),
      ]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function initPostgresDispatcher(db: Store, username: string, password: string) {
  if (!/^[a-z0-9._-]{3,40}$/.test(username) || password.length < 12 || password.length > 128)
    throw new DeploymentConfigError('Username: 3–40 znaků a-z/0-9/._-. Heslo: 12–128 znaků.');
  const encoded = await hashPassword(password);
  return db.transaction(async () => {
    if (await db.prepare("SELECT id FROM users WHERE role='dispatcher' LIMIT 1").get())
      return false;
    const id = randomUUID();
    await db
      .prepare(
        "INSERT INTO users (id,username,password_hash,role,display_name) VALUES (?,?,?,'dispatcher',?)",
      )
      .run(id, username, encoded, username);
    await audit(db, null, 'user.initialized', 'user', id, null, { username, role: 'dispatcher' });
    return true;
  });
}
