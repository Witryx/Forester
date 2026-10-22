import { randomUUID } from 'node:crypto';
import { audit, transaction, type Db } from './db.js';
import { hashPassword } from './security.js';
import { createReservation } from './planning.js';
export async function seedDemo(db: Db) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo data nejsou povolena v produkci.');
  if (db.prepare("SELECT key FROM settings WHERE key='demo'").get()) return;
  if (Number(db.prepare('SELECT COUNT(*) AS n FROM users').get()!.n))
    throw new Error(
      'Demo lze vytvořit pouze v prázdné databázi. Existující účty zůstávají zachované.',
    );
  const password = await hashPassword('ForesterDemo!2026');
  transaction(db, () => {
    if (Number(db.prepare('SELECT COUNT(*) AS n FROM users').get()!.n))
      throw new Error('Databáze byla mezitím inicializovaná. Existující data zůstávají zachovaná.');
    for (const [id, code, first, last, phone] of [
      ['driver-1', 'ZAM-001', 'Martin', 'Novák', '+420 777 123 456'],
      ['driver-2', 'ZAM-002', 'Tomáš', 'Dvořák', '+420 777 234 567'],
      ['driver-3', 'ZAM-003', 'Pavel', 'Svoboda', '+420 777 345 678'],
    ])
      db.prepare(
        'INSERT INTO employees (id,code,first_name,last_name,phone) VALUES (?,?,?,?,?)',
      ).run(id, code, first, last, phone);
    db.prepare(
      "INSERT INTO users (id,username,password_hash,role,display_name) VALUES ('admin-1','dispecer',?,'dispatcher','Petr Hetzendorf')",
    ).run(password);
    db.prepare(
      "INSERT INTO users (id,username,password_hash,role,display_name,employee_id) VALUES ('user-driver-1','ridic',?,'driver','Martin Novák','driver-1')",
    ).run(password);
    for (const [id, plate, make, model, crane, km] of [
      ['vehicle-1', '3J5 4821', 'Scania', 'R 540', 1, 247700],
      ['vehicle-2', '4J2 9016', 'Volvo', 'FH 500', 1, 184200],
      ['vehicle-3', '6J1 3378', 'MAN', 'TGX 26.510', 0, 92300],
    ] as const)
      db.prepare(
        'INSERT INTO vehicles (id,plate,manufacturer,model,crane,odometer_km,capacity_kg,year) VALUES (?,?,?,?,?,?,26000,2022)',
      ).run(id, plate, make, model, crane, km);
    for (const [id, plate, make, model] of [
      ['trailer-1', '7J0 1862', 'DOLL', 'Logo 21'],
      ['trailer-2', '8J2 4430', 'Schwarzmüller', 'Timber'],
      ['trailer-3', '9J1 7724', 'DOLL', 'Logo 21'],
    ])
      db.prepare(
        'INSERT INTO trailers (id,plate,manufacturer,model,capacity_kg) VALUES (?,?,?,?,26000)',
      ).run(id, plate, make, model);
    for (let i = 1; i <= 3; i++)
      db.prepare('INSERT INTO default_assignments VALUES (?,?,?,?,?,?,NULL)').run(
        `assignment-${i}`,
        `driver-${i}`,
        `vehicle-${i}`,
        `trailer-${i}`,
        26000,
        Date.now(),
      );
    db.prepare("INSERT INTO settings VALUES ('demo','true')").run();
    audit(db, null, 'demo.initialized', 'system', 'demo', null, {
      users: 2,
      employees: 3,
      vehicles: 3,
    });
    const date = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Prague',
    }).format(new Date());
    const offset = new Intl.DateTimeFormat('en', {
      timeZone: 'Europe/Prague',
      timeZoneName: 'shortOffset',
    })
      .formatToParts(new Date(`${date}T12:00:00Z`))
      .find((p) => p.type === 'timeZoneName')!
      .value.endsWith('2')
      ? '+02:00'
      : '+01:00';
    const actor = { id: 'admin-1', username: 'dispecer' };
    for (const [i, pickup, delivery, start, end, note] of [
      [
        1,
        'Lesní správa Jihlava',
        'Pila Paskov',
        '06:30',
        '10:00',
        'Nakládka u závory, kontakt na místě: +420 777 987 654.',
      ],
      [
        2,
        'Nové Město na Moravě',
        'Dřevozpracující závod Ždírec',
        '07:00',
        '11:30',
        'Smrková kulatina · příjezd přes severní bránu.',
      ],
      [3, 'Lesní správa Telč', 'Pila Javořice', '08:00', '12:00', 'Nakládku zajistí zákazník.'],
      [1, 'Velké Meziříčí', 'Pila Lukavec', '11:00', '15:30', 'Druhá jízda, odbavení u vrátnice.'],
    ] as const)
      createReservation(
        db,
        {
          pickup,
          delivery,
          startsAt: Date.parse(`${date}T${start}:00${offset}`),
          endsAt: Date.parse(`${date}T${end}:00${offset}`),
          employeeId: `driver-${i}`,
          vehicleId: `vehicle-${i}`,
          trailerId: `trailer-${i}`,
          requiresCrane: i !== 3,
          requiresTrailer: true,
          weightKg: 22000,
          approvedCapacityKg: 26000,
          note,
        },
        actor,
      );
  });
}
export async function initDispatcher(db: Db, username: string, password: string) {
  if (!/^[a-z0-9._-]{3,40}$/.test(username) || password.length < 12 || password.length > 128)
    throw new Error('Username: 3–40 znaků a-z/0-9/._-. Heslo: 12–128 znaků.');
  const encoded = await hashPassword(password);
  transaction(db, () => {
    if (Number(db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='dispatcher'").get()!.n))
      throw new Error('Inicializace je určena pouze pro první účet.');
    const id = randomUUID();
    db.prepare(
      "INSERT INTO users (id,username,password_hash,role,display_name) VALUES (?,?,?,'dispatcher',?)",
    ).run(id, username, encoded, username);
    audit(db, null, 'user.initialized', 'user', id, null, {
      username,
      role: 'dispatcher',
    });
  });
}
