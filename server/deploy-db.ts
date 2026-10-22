import { openPostgres, migratePostgres, initPostgresDispatcher } from './postgres';

if (!process.env.DATABASE_URL) throw new Error('Nastavte DATABASE_URL pro databázi Foresteru.');
const { pool, store } = openPostgres(process.env.DATABASE_URL);
try {
  await migratePostgres(pool);
  if (process.env.INIT_USERNAME || process.env.INIT_PASSWORD) {
    if (!process.env.INIT_USERNAME || !process.env.INIT_PASSWORD)
      throw new Error('Pro první účet nastavte INIT_USERNAME i INIT_PASSWORD.');
    const created = await initPostgresDispatcher(
      store,
      process.env.INIT_USERNAME,
      process.env.INIT_PASSWORD,
    );
    console.log(
      created ? 'První dispečer vytvořen.' : 'Dispečer již existuje; účet zůstává zachovaný.',
    );
  }
  console.log('PostgreSQL migrace dokončeny.');
} catch (error) {
  // Driver errors can contain connection details; never print the URL or full driver error.
  console.error(
    'Příprava databáze selhala. Zkontrolujte připojení, migrace a inicializační proměnné.',
  );
  if (error instanceof Error && !('code' in error)) console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
