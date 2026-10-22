import { attachDatabasePool } from '@vercel/functions';
import { createApp } from '../server/app.js';
import { openPostgres } from '../server/postgres.js';
import { createVercelHandler } from '../server/vercel-handler.js';

let appPromise: ReturnType<typeof createApp> | undefined;
function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL');
      const { pool, store } = openPostgres(process.env.DATABASE_URL);
      attachDatabasePool(pool);
      try {
        return await createApp(store);
      } catch (error) {
        await pool.end();
        throw error;
      }
    })().catch((error) => {
      appPromise = undefined;
      throw error;
    });
  }
  return appPromise;
}

export default createVercelHandler(getApp);
