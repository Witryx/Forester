import { openDb } from './db.js';
import { seedDemo, initDispatcher } from './seed.js';
const db = openDb();
try {
  switch (process.argv[2]) {
    case 'migrate':
      console.log('Migrace dokončeny.');
      break;
    case 'seed':
      await seedDemo(db);
      console.log('Demo je připravené. Přístupy najdete v README.');
      break;
    case 'init': {
      if (!process.env.INIT_USERNAME || !process.env.INIT_PASSWORD)
        throw new Error('Nastavte INIT_USERNAME a INIT_PASSWORD do prostředí.');
      await initDispatcher(db, process.env.INIT_USERNAME, process.env.INIT_PASSWORD);
      console.log('První dispečer vytvořen.');
      break;
    }
    default:
      throw new Error('Použijte migrate, seed nebo init.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Inicializace selhala.');
  process.exitCode = 1;
} finally {
  db.close();
}
