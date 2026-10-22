import { openDb } from '../server/db';
import { createReservation, reservationInput } from '../server/planning';
const db = openDb(process.argv[2]);
process.stdout.write('ready\n');
process.stdin.once('data', () => {
  try {
    createReservation(db, reservationInput.parse(JSON.parse(process.argv[3])), {
      id: 'admin-1',
      username: 'dispecer',
    });
    process.stdout.write('success\n');
  } catch {
    process.stdout.write('conflict\n');
  } finally {
    db.close();
    process.stdin.destroy();
  }
});
