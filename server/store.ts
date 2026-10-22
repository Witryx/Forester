import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { SQLInputValue } from 'node:sqlite';
import type { Db } from './db';
import { qualifyPostgresTables } from './postgres-schema';

export type Row = Record<string, unknown>;
type Result = { rows: Row[]; rowCount: number | null };
export interface Connection {
  query(sql: string, values?: unknown[]): Promise<Result>;
  release(): void;
}
export interface ConnectionPool {
  query(sql: string, values?: unknown[]): Promise<Result>;
  connect(): Promise<Connection>;
  end(): Promise<void>;
}
export interface Store {
  dialect: 'sqlite' | 'postgres';
  prepare(sql: string): {
    get(...values: unknown[]): Promise<Row | undefined>;
    all(...values: unknown[]): Promise<Row[]>;
    run(...values: unknown[]): Promise<{ changes: number }>;
  };
  transaction<T>(action: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function statement(query: (sql: string, values: unknown[]) => Promise<Result>, sql: string) {
  return {
    get: async (...values: unknown[]) => (await query(sql, values)).rows[0],
    all: async (...values: unknown[]) => (await query(sql, values)).rows,
    run: async (...values: unknown[]) => ({ changes: (await query(sql, values)).rowCount ?? 0 }),
  };
}

// SQL values stay bound parameters, including when a literal contains a question mark.
export function postgresParameters(sql: string) {
  let index = 0;
  return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g, (part) =>
    part === '?' ? `$${++index}` : part,
  );
}

export function postgresStore(pool: ConnectionPool): Store {
  const context = new AsyncLocalStorage<Connection>();
  const query = async (sql: string, values: unknown[]) => {
    const result = await (context.getStore() ?? pool).query(
      postgresParameters(qualifyPostgresTables(sql)),
      values,
    );
    // The pool parses PostgreSQL int8 as bigint; API timestamps and counters use JS numbers.
    return {
      ...result,
      rows: result.rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            typeof value === 'bigint' ? Number(value) : value,
          ]),
        ),
      ),
    };
  };
  return {
    dialect: 'postgres',
    prepare: (sql) => statement(query, sql),
    async transaction(action) {
      if (context.getStore()) throw new Error('Nested account transactions are not supported.');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Serialize account writes across Vercel instances: employee codes and last dispatcher.
        await client.query('SELECT pg_advisory_xact_lock(614327801)');
        const result = await context.run(client, action);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

const adapters = new WeakMap<Db, Store>();
export function asStore(database: Db | Store): Store {
  if ('dialect' in database) return database;
  const previous = adapters.get(database);
  if (previous) return previous;
  const context = new AsyncLocalStorage<boolean>();
  let tail = Promise.resolve<unknown>(undefined);
  const serialize = <T>(action: () => Promise<T>): Promise<T> => {
    const result = tail.then(action);
    tail = result.catch(() => {});
    return result;
  };
  const query = async (sql: string, values: unknown[]): Promise<Result> => {
    const execute = async () => {
      const prepared = database.prepare(sql);
      const parameters = values as SQLInputValue[];
      if (/^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql))
        return { rows: prepared.all(...parameters), rowCount: 0 };
      return { rows: [], rowCount: Number(prepared.run(...parameters).changes) };
    };
    return context.getStore() ? execute() : serialize(execute);
  };
  const store: Store = {
    dialect: 'sqlite',
    prepare: (sql) => statement(query, sql),
    transaction: (action) =>
      serialize(async () => {
        database.exec('BEGIN IMMEDIATE');
        try {
          const result = await context.run(true, action);
          database.exec('COMMIT');
          return result;
        } catch (error) {
          database.exec('ROLLBACK');
          throw error;
        }
      }),
    close: async () => {
      await tail;
      database.close();
    },
  };
  adapters.set(database, store);
  return store;
}

export const transaction = <T>(db: Store, action: () => Promise<T>) => db.transaction(action);
export async function audit(
  db: Store,
  actor: { id: string; username: string } | null,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
  correlationId: string = randomUUID(),
) {
  await db
    .prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(
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
