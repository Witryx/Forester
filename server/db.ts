import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
export type Db = DatabaseSync;
export function openDb(path = process.env.DATABASE_PATH || './data/forester.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)',
  );
  const folder = fileURLToPath(new URL('./migrations/', import.meta.url));
  for (const name of readdirSync(folder)
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    if (!db.prepare('SELECT name FROM schema_migrations WHERE name=?').get(name)) {
      transaction(db, () => {
        if (db.prepare('SELECT name FROM schema_migrations WHERE name=?').get(name)) return;
        db.exec(readFileSync(resolve(folder, name), 'utf8'));
        db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(name, Date.now());
      });
    }
  }
  return db;
}
export function transaction<T>(db: Db, action: () => T): T {
  if (db.isTransaction) {
    const savepoint = `nested_${randomUUID().replaceAll('-', '')}`;
    db.exec(`SAVEPOINT ${savepoint}`);
    try {
      const result = action();
      db.exec(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (error) {
      db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}; RELEASE SAVEPOINT ${savepoint}`);
      throw error;
    }
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
export function audit(
  db: Db,
  actor: { id: string; username: string } | null,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
  correlationId: string = randomUUID(),
) {
  db.prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,?,?,?,?,?)').run(
    randomUUID(),
    actor?.id ?? null,
    actor?.username ?? 'Inicializace',
    action,
    entityType,
    entityId,
    before == null ? null : JSON.stringify(before),
    after == null ? null : JSON.stringify(after),
    Date.now(),
    correlationId,
  );
}
