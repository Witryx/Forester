import { openPostgres, migratePostgres, initPostgresDispatcher } from './postgres';
import {
  DeploymentConfigError,
  describeDeploymentError,
  type DeploymentStage,
} from './deploy-errors';

let connection: ReturnType<typeof openPostgres> | undefined;
let stage: DeploymentStage = 'nastavení';
try {
  if (!process.env.DATABASE_URL)
    throw new DeploymentConfigError('Nastavte DATABASE_URL pro databázi Foresteru.');
  connection = openPostgres(process.env.DATABASE_URL);
  const { pool, store } = connection;
  stage = 'připojení';
  await pool.query('SELECT 1');
  console.log('PostgreSQL připojení ověřeno.');
  stage = 'migrace';
  await migratePostgres(pool);
  console.log('PostgreSQL migrace dokončeny.');
  stage = 'první účet';
  if (process.env.INIT_USERNAME || process.env.INIT_PASSWORD) {
    if (!process.env.INIT_USERNAME || !process.env.INIT_PASSWORD)
      throw new DeploymentConfigError('Pro první účet nastavte INIT_USERNAME i INIT_PASSWORD.');
    const created = await initPostgresDispatcher(
      store,
      process.env.INIT_USERNAME,
      process.env.INIT_PASSWORD,
    );
    console.log(
      created ? 'První dispečer vytvořen.' : 'Dispečer již existuje; účet zůstává zachovaný.',
    );
  }
} catch (error) {
  console.error(describeDeploymentError(error, stage));
  process.exitCode = 1;
} finally {
  await connection?.pool.end();
}
