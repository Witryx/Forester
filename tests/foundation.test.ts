import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { type AddressInfo } from 'node:net';
import { openDb, transaction, audit } from '../server/db';
import { createApp } from '../server/app';
import { seedDemo } from '../server/seed';
import { createReservation, overlaps, reservationInput } from '../server/planning';
import { hashPassword, verifyPassword } from '../server/security';
const actor = { id: 'admin-1', username: 'dispecer' };
const input = (overrides: Record<string, unknown> = {}) =>
  reservationInput.parse({
    pickup: 'Testovací les',
    delivery: 'Testovací pila',
    startsAt: '2027-01-12T10:00:00+01:00',
    endsAt: '2027-01-12T12:00:00+01:00',
    employeeId: 'driver-1',
    vehicleId: 'vehicle-1',
    trailerId: 'trailer-1',
    requiresCrane: true,
    requiresTrailer: true,
    weightKg: 22000,
    approvedCapacityKg: 26000,
    note: 'Test',
    ...overrides,
  });
async function fixture() {
  const db = openDb(':memory:');
  await seedDemo(db);
  return db;
}
async function httpFixture() {
  const db = await fixture();
  const app = await createApp(db, { origin: 'http://localhost:5173' });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (
    path: string,
    body?: unknown,
    cookie = '',
    csrf = '',
    method?: string,
    origin = 'http://localhost:5173',
  ) =>
    fetch(base + path, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(origin ? { Origin: origin } : {}),
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  async function login(username = 'dispecer', password = 'ForesterDemo!2026') {
    const response = await call('/api/auth/login', { username, password });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    const bootstrap = await call('/api/bootstrap', undefined, cookie);
    const data = (await bootstrap.json()) as {
      csrfToken: string;
      user: { id: string; version: number };
      employees: unknown[];
    };
    return { cookie, csrf: data.csrfToken, data };
  }
  return {
    db,
    call,
    login,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
      db.close();
    },
  };
}
test('Solený scrypt: stejná hesla mají různé hashe, ověření odmítne jiné heslo', async () => {
  const a = await hashPassword('test-password-123');
  const b = await hashPassword('test-password-123');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('test-password-123', a), true);
  assert.equal(await verifyPassword('wrong', a), false);
});
test('Polouzavřené intervaly: dotyk není konflikt, půlnoc a překryv jsou správně', () => {
  assert.equal(overlaps({ start: 1, end: 2 }, { start: 2, end: 3 }), false);
  assert.equal(overlaps({ start: 1, end: 3 }, { start: 2, end: 4 }), true);
  const a = input({
    startsAt: '2027-01-12T23:00:00+01:00',
    endsAt: '2027-01-13T02:00:00+01:00',
  });
  assert.equal(a.endsAt - a.startsAt, 3 * 3600_000);
});
test('Časy vyžadují offset a správně rozliší opakovanou hodinu při změně času', () => {
  assert.throws(() => input({ startsAt: '2026-10-25T02:30:00', endsAt: '2026-10-25T03:30:00' }));
  const a = input({
    startsAt: '2026-10-25T02:30:00+02:00',
    endsAt: '2026-10-25T02:30:00+01:00',
  });
  assert.equal(a.endsAt - a.startsAt, 3600_000);
  assert.throws(() => input({ endsAt: '2027-01-12T09:00:00+01:00' }));
});
test('Rezervace, tři prostředky, událost a audit se uloží atomicky', async () => {
  const db = await fixture();
  try {
    const result = createReservation(db, input(), actor);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS n FROM reservations WHERE order_id=?').get(result.id)!.n,
      3,
    );
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM audit_events WHERE entity_id=? AND action='reservation.created'",
        )
        .get(result.id)!.n,
      1,
    );
    assert.equal(
      db
        .prepare('SELECT COUNT(*) AS n FROM outbox_events WHERE dedup_key=?')
        .get(`order.assigned:${result.id}`)!.n,
      1,
    );
  } finally {
    db.close();
  }
});
test('Překryv samostatného návěsu blokuje celý zápis bez osiřelé zakázky', async () => {
  const db = await fixture();
  try {
    createReservation(db, input(), actor);
    const count = db.prepare('SELECT COUNT(*) AS n FROM orders').get()!.n;
    assert.throws(
      () => createReservation(db, input({ employeeId: 'driver-2', vehicleId: 'vehicle-2' }), actor),
      /koliduje/,
    );
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get()!.n, count);
  } finally {
    db.close();
  }
});
test('Navazující termín je povolen', async () => {
  const db = await fixture();
  try {
    createReservation(db, input(), actor);
    createReservation(
      db,
      input({
        startsAt: '2027-01-12T12:00:00+01:00',
        endsAt: '2027-01-12T14:00:00+01:00',
      }),
      actor,
    );
  } finally {
    db.close();
  }
});
test('Nepřítomnost na hranici, otevřená odstávka a neaktivní řidič', async () => {
  const db = await fixture();
  try {
    const a = input();
    db.prepare('INSERT INTO absences VALUES (?,?,?,?,?,?)').run(
      'absence',
      'driver-1',
      'vacation',
      a.startsAt - 3600_000,
      a.startsAt,
      actor.id,
    );
    createReservation(db, a, actor);
    db.prepare(
      "INSERT INTO downtimes (id,vehicle_id,kind,starts_at,reason) VALUES ('down','vehicle-2','service',?,'Servis')",
    ).run(a.startsAt);
    assert.throws(
      () =>
        createReservation(
          db,
          input({
            employeeId: 'driver-2',
            vehicleId: 'vehicle-2',
            trailerId: 'trailer-2',
          }),
          actor,
        ),
      /odstávku/,
    );
    db.prepare('UPDATE employees SET active=0 WHERE id=?').run('driver-3');
    assert.throws(
      () =>
        createReservation(
          db,
          input({
            employeeId: 'driver-3',
            vehicleId: 'vehicle-3',
            trailerId: 'trailer-3',
            requiresCrane: false,
          }),
          actor,
        ),
      /aktivního/,
    );
    db.prepare('INSERT INTO absences VALUES (?,?,?,?,?,?)').run(
      'sick',
      'driver-2',
      'sick',
      a.startsAt,
      a.endsAt,
      actor.id,
    );
    assert.throws(
      () =>
        createReservation(
          db,
          input({
            employeeId: 'driver-2',
            vehicleId: 'vehicle-3',
            trailerId: 'trailer-3',
            requiresCrane: false,
          }),
          actor,
        ),
      /nepřítomný/,
    );
  } finally {
    db.close();
  }
});
test('Tvrdé požadavky: ruka, návěs, schválená kapacita', async () => {
  const db = await fixture();
  try {
    assert.throws(() => createReservation(db, input({ vehicleId: 'vehicle-3' }), actor), /ruku/);
    assert.throws(() => createReservation(db, input({ trailerId: null }), actor), /návěs/);
    assert.throws(
      () => createReservation(db, input({ approvedCapacityKg: null }), actor),
      /kapacita/,
    );
    assert.throws(
      () => createReservation(db, input({ approvedCapacityKg: 21000 }), actor),
      /kapacita/,
    );
  } finally {
    db.close();
  }
});
test('Probíhající práce blokuje soupravu i po plánovaném konci', async () => {
  const db = await fixture();
  try {
    const first = createReservation(db, input(), actor);
    db.prepare("UPDATE orders SET status='in_progress' WHERE id=?").run(first.id);
    assert.throws(
      () =>
        createReservation(
          db,
          input({
            startsAt: '2027-01-12T14:00:00+01:00',
            endsAt: '2027-01-12T16:00:00+01:00',
          }),
          actor,
        ),
      /koliduje/,
    );
  } finally {
    db.close();
  }
});
test('DB odmítne překryv a audit nelze upravit ani smazat', async () => {
  const db = await fixture();
  try {
    const result = createReservation(db, input(), actor);
    assert.throws(
      () =>
        db
          .prepare('INSERT INTO reservations VALUES (?,?,?,?,?,?,?)')
          .run('invalid', result.id, 'driver-1', null, null, input().startsAt, input().endsAt),
      /reservation_conflict/,
    );
    assert.throws(() => db.exec("UPDATE audit_events SET action='tampered'"), /audit_immutable/);
    assert.throws(() => db.exec('DELETE FROM audit_events'), /audit_immutable/);
  } finally {
    db.close();
  }
});
test('Selhání auditu vrátí i obchodní změnu', async () => {
  const db = await fixture();
  try {
    assert.throws(() =>
      transaction(db, () => {
        db.prepare("UPDATE users SET display_name='Změna' WHERE id='admin-1'").run();
        audit(
          db,
          { id: 'nonexistent', username: 'x' },
          'user.updated',
          'user',
          'admin-1',
          null,
          {},
        );
      }),
    );
    assert.equal(
      db.prepare("SELECT display_name FROM users WHERE id='admin-1'").get()!.display_name,
      'Petr Hetzendorf',
    );
  } finally {
    db.close();
  }
});
test('Říjnový řidič dostane pouze údaje účtu a nemá správu uživatelů', async () => {
  const f = await httpFixture();
  try {
    const d = await f.login('ridic');
    assert.equal((await f.call('/api/users', undefined, d.cookie)).status, 403);
    assert.equal((await f.call('/api/users', {}, d.cookie, d.csrf)).status, 403);
    assert.equal((await f.call('/api/users/admin-1', {}, d.cookie, d.csrf, 'PATCH')).status, 403);
    assert.equal(
      (await f.call('/api/users/admin-1/reset-password', {}, d.cookie, d.csrf)).status,
      403,
    );
    assert.equal(d.data.employees.length, 0);
    assert.deepEqual(Object.keys(d.data).sort(), [
      'csrfToken',
      'demo',
      'employees',
      'fetchedAt',
      'user',
    ]);
  } finally {
    await f.close();
  }
});
test('Session cookie je HttpOnly/SameSite, odhlášení zneplatní session', async () => {
  const f = await httpFixture();
  try {
    const response = await f.call('/api/auth/login', {
      username: 'dispecer',
      password: 'ForesterDemo!2026',
    });
    assert.match(response.headers.get('set-cookie')!, /HttpOnly/);
    assert.match(response.headers.get('set-cookie')!, /SameSite=Strict/);
    const d = await f.login();
    assert.equal((await f.call('/api/auth/logout', {}, d.cookie, d.csrf)).status, 200);
    assert.equal((await f.call('/api/bootstrap', undefined, d.cookie)).status, 401);
  } finally {
    await f.close();
  }
});
test('AT-03: deaktivace ihned zneplatní session i nové přihlášení', async () => {
  const f = await httpFixture();
  try {
    const a = await f.login();
    const d = await f.login('ridic');
    const result = await f.call(
      '/api/users/user-driver-1',
      {
        username: 'ridic',
        displayName: 'Martin Novák',
        active: false,
        role: 'driver',
        employeeId: 'driver-1',
        version: 1,
      },
      a.cookie,
      a.csrf,
      'PATCH',
    );
    assert.equal(result.status, 200);
    assert.equal((await f.call('/api/bootstrap', undefined, d.cookie)).status, 401);
    assert.equal(
      (
        await f.call('/api/auth/login', {
          username: 'ridic',
          password: 'ForesterDemo!2026',
        })
      ).status,
      401,
    );
    assert.equal(
      f.db.prepare("SELECT COUNT(*) AS n FROM orders WHERE employee_id='driver-1'").get()!.n,
      2,
    );
  } finally {
    await f.close();
  }
});
test('Posledního dispečera nelze deaktivovat a zastaralá verze se nepřepíše', async () => {
  const f = await httpFixture();
  try {
    const a = await f.login();
    assert.equal(
      (
        await f.call(
          '/api/users/admin-1',
          {
            username: 'dispecer',
            displayName: 'Petr Hetzendorf',
            active: false,
            role: 'dispatcher',
            employeeId: null,
            version: 1,
          },
          a.cookie,
          a.csrf,
          'PATCH',
        )
      ).status,
      422,
    );
    assert.equal(
      (
        await f.call(
          '/api/users/user-driver-1',
          {
            username: 'ridic',
            displayName: 'Martin Novák',
            active: true,
            role: 'driver',
            employeeId: 'driver-1',
            version: 99,
          },
          a.cookie,
          a.csrf,
          'PATCH',
        )
      ).status,
      409,
    );
  } finally {
    await f.close();
  }
});
test('Úprava jména, přihlášení a role zneplatní session a uloží audit', async () => {
  const f = await httpFixture();
  try {
    const a = await f.login();
    const d = await f.login('ridic');
    const edit = {
      username: '  NOVY.DISPECER  ',
      displayName: '  Martin Nový  ',
      active: true,
      role: 'dispatcher',
      employeeId: null,
      version: 1,
    };
    assert.equal(
      (await f.call('/api/users/user-driver-1', edit, a.cookie, a.csrf, 'PATCH')).status,
      200,
    );
    assert.equal((await f.call('/api/bootstrap', undefined, d.cookie)).status, 401);
    assert.equal(
      (await f.call('/api/auth/login', { username: 'ridic', password: 'ForesterDemo!2026' }))
        .status,
      401,
    );
    const renamed = await f.login('novy.dispecer');
    assert.equal((await f.call('/api/users', undefined, renamed.cookie)).status, 200);
    const user = f.db
      .prepare('SELECT username,display_name,role,version FROM users WHERE id=?')
      .get('user-driver-1')!;
    assert.equal(user.username, 'novy.dispecer');
    assert.equal(user.display_name, 'Martin Nový');
    assert.equal(user.version, 2);
    const event = f.db
      .prepare(
        "SELECT before_json,after_json FROM audit_events WHERE action='user.updated' AND entity_id=?",
      )
      .get('user-driver-1')!;
    assert.equal(JSON.parse(event.before_json as string).username, 'ridic');
    assert.equal(JSON.parse(event.after_json as string).display_name, 'Martin Nový');
    assert.equal(
      (
        await f.call(
          '/api/users/user-driver-1',
          {
            ...edit,
            username: 'novy.ridic',
            role: 'driver',
            employeeId: 'driver-1',
            version: 2,
          },
          renamed.cookie,
          renamed.csrf,
          'PATCH',
        )
      ).status,
      200,
    );
    assert.equal((await f.call('/api/bootstrap', undefined, renamed.cookie)).status, 401);
    const driver = await f.login('novy.ridic');
    assert.equal((await f.call('/api/users', undefined, driver.cookie)).status, 403);
    assert.equal(driver.data.employees.length, 0);
  } finally {
    await f.close();
  }
});

test('Duplicitní nebo neplatné přihlášení při úpravě nezmění účet ani session', async () => {
  const f = await httpFixture();
  try {
    const a = await f.login();
    const d = await f.login('ridic');
    const before = f.db.prepare('SELECT * FROM users WHERE id=?').get('user-driver-1');
    const edit = {
      username: 'DISPECER',
      displayName: 'Jiné jméno',
      active: false,
      role: 'driver',
      employeeId: 'driver-1',
      version: 1,
    };
    assert.equal(
      (await f.call('/api/users/user-driver-1', edit, a.cookie, a.csrf, 'PATCH')).status,
      409,
    );
    assert.equal(
      (
        await f.call(
          '/api/users/user-driver-1',
          { ...edit, username: 'neplatné jméno' },
          a.cookie,
          a.csrf,
          'PATCH',
        )
      ).status,
      422,
    );
    assert.deepEqual(f.db.prepare('SELECT * FROM users WHERE id=?').get('user-driver-1'), before);
    assert.equal((await f.call('/api/bootstrap', undefined, d.cookie)).status, 200);
    assert.equal(
      f.db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='user.updated'").get()!.n,
      0,
    );
  } finally {
    await f.close();
  }
});

test('CSRF a origin: zápis bez tokenu, cizí origin i chybějící origin jsou odmítnuty', async () => {
  const f = await httpFixture();
  try {
    const a = await f.login();
    assert.equal((await f.call('/api/auth/logout', {}, a.cookie)).status, 403);
    assert.equal(
      (await f.call('/api/auth/logout', {}, a.cookie, a.csrf, undefined, 'https://other.example'))
        .status,
      403,
    );
    assert.equal(
      (
        await f.call(
          '/api/auth/login',
          { username: 'dispecer', password: 'ForesterDemo!2026' },
          '',
          '',
          undefined,
          '',
        )
      ).status,
      403,
    );
  } finally {
    await f.close();
  }
});
test('Reset hesla odhlásí řidiče a vynutí změnu; hash ani heslo neunikají do auditu', async () => {
  const f = await httpFixture();
  try {
    const a = await f.login();
    const d = await f.login('ridic');
    const password = 'NewTemporary!2026';
    assert.equal(
      (
        await f.call(
          '/api/users/user-driver-1/reset-password',
          { password, version: 1 },
          a.cookie,
          a.csrf,
        )
      ).status,
      200,
    );
    assert.equal((await f.call('/api/bootstrap', undefined, d.cookie)).status, 401);
    const n = await f.login('ridic', password);
    assert.equal(n.data.employees.length, 0);
    assert.equal((await f.call('/api/orders/x', undefined, n.cookie)).status, 403);
    const newPassword = 'ChangedPersonal!2026';
    assert.equal(
      (
        await f.call(
          '/api/auth/password',
          { currentPassword: password, newPassword },
          n.cookie,
          n.csrf,
        )
      ).status,
      200,
    );
    assert.equal((await f.call('/api/bootstrap', undefined, n.cookie)).status, 401);
    const logged = await f.login('ridic', newPassword);
    assert.equal(logged.data.user.id, 'user-driver-1');
    const audits = JSON.stringify(f.db.prepare('SELECT * FROM audit_events').all());
    assert.equal(audits.includes(password), false);
    assert.equal(audits.includes(newPassword), false);
    assert.equal(audits.includes('scrypt:'), false);
  } finally {
    await f.close();
  }
});
test('Správa vytvoří účet a odmítne duplicitní username i profil', async () => {
  const f = await httpFixture();
  try {
    const a = await f.login();
    const body = {
      username: 'novy.ridic',
      displayName: 'Tomáš Dvořák',
      role: 'driver',
      employeeId: 'driver-2',
      password: 'TemporaryDemo!2026',
    };
    assert.equal((await f.call('/api/users', body, a.cookie, a.csrf)).status, 201);
    assert.equal((await f.call('/api/users', body, a.cookie, a.csrf)).status, 409);
    assert.equal(
      (await f.call('/api/users', { ...body, username: 'jiny.ridic' }, a.cookie, a.csrf)).status,
      409,
    );
  } finally {
    await f.close();
  }
});
test('Nový řidič dostane vlastní profil, unikátní kód a propojený účet s auditem', async () => {
  const f = await httpFixture();
  try {
    const a = await f.login();
    const body = {
      username: 'jana.nova',
      displayName: 'Jana Nová',
      role: 'driver',
      employeeId: null,
      newEmployee: { firstName: ' Jana ', lastName: ' Nová ' },
      password: 'TemporaryDemo!2026',
    };
    const response = await f.call('/api/users', body, a.cookie, a.csrf);
    assert.equal(response.status, 201);
    const { id } = (await response.json()) as { id: string };
    const profile = f.db
      .prepare('SELECT e.* FROM employees e JOIN users u ON u.employee_id=e.id WHERE u.id=?')
      .get(id)!;
    assert.equal(profile.first_name, 'Jana');
    assert.equal(profile.last_name, 'Nová');
    assert.equal(profile.code, 'ZAM-004');
    assert.equal(profile.active, 1);
    const driver = await f.login(body.username, body.password);
    assert.equal(driver.data.user.id, id);
    assert.equal((await f.call('/api/users', undefined, driver.cookie)).status, 403);
    const bootstrap = await f.call('/api/bootstrap', undefined, a.cookie);
    const data = (await bootstrap.json()) as { employees: { id: string }[] };
    assert(data.employees.some((e) => e.id === profile.id));
    const events = f.db
      .prepare('SELECT * FROM audit_events WHERE entity_id IN (?,?) ORDER BY rowid')
      .all(profile.id, id);
    const created = events.filter((e) =>
      ['employee.created', 'user.created'].includes(e.action as string),
    );
    assert.equal(created.length, 2);
    assert.equal(created[0].correlation_id, created[1].correlation_id);
    assert.equal(JSON.parse(created[1].after_json as string).employeeId, profile.id);
    assert(!JSON.stringify(events).includes(body.password));
    assert(!JSON.stringify(events).includes('scrypt:'));
    assert.equal(
      (await f.call('/api/users', { ...body, username: 'jana.druha' }, a.cookie, a.csrf)).status,
      201,
    );
    assert(f.db.prepare("SELECT id FROM employees WHERE code='ZAM-005'").get());
  } finally {
    await f.close();
  }
});

test('Chyba uložení účtu nezanechá nový profil ani jeho audit', async () => {
  const f = await httpFixture();
  try {
    const a = await f.login();
    const before = f.db.prepare('SELECT COUNT(*) AS n FROM employees').get()!.n;
    const body = {
      username: 'dispecer',
      displayName: 'Jana Nová',
      role: 'driver',
      employeeId: null,
      newEmployee: { firstName: 'Jana', lastName: 'Nová' },
      password: 'TemporaryDemo!2026',
    };
    assert.equal((await f.call('/api/users', body, a.cookie, a.csrf)).status, 409);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM employees').get()!.n, before);
    assert.equal(
      f.db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='employee.created'").get()!
        .n,
      0,
    );
    assert.equal(
      (await f.call('/api/users', { ...body, username: 'jana.nova' }, a.cookie, a.csrf)).status,
      201,
    );
    assert(f.db.prepare("SELECT id FROM employees WHERE code='ZAM-004'").get());
  } finally {
    await f.close();
  }
});

test('Vytvoření profilu vyžaduje dispečera, platná jména a jediný způsob propojení', async () => {
  const f = await httpFixture();
  try {
    const a = await f.login();
    const d = await f.login('ridic');
    const body = {
      username: 'jana.nova',
      displayName: 'Jana Nová',
      role: 'driver',
      employeeId: null,
      newEmployee: { firstName: 'Jana', lastName: 'Nová' },
      password: 'TemporaryDemo!2026',
    };
    assert.equal((await f.call('/api/users', body, d.cookie, d.csrf)).status, 403);
    for (const invalid of [
      { ...body, employeeId: 'driver-2' },
      { ...body, newEmployee: undefined },
      { ...body, role: 'dispatcher' },
      { ...body, newEmployee: { firstName: '  ', lastName: 'Nová' } },
      { ...body, newEmployee: { firstName: 'Jana', lastName: '' } },
    ]) {
      assert.equal((await f.call('/api/users', invalid, a.cookie, a.csrf)).status, 422);
    }
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM employees').get()!.n, 3);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM users').get()!.n, 2);
  } finally {
    await f.close();
  }
});

test('Neznámý účet a špatné heslo mají stejnou chybu; brute force je omezen', async () => {
  const f = await httpFixture();
  try {
    const one = await f.call('/api/auth/login', {
      username: 'unknown',
      password: 'wrong',
    });
    const two = await f.call('/api/auth/login', {
      username: 'dispecer',
      password: 'wrong',
    });
    assert.equal(one.status, two.status);
    assert.deepEqual(await one.json(), await two.json());
    for (let i = 0; i < 8; i++)
      assert.equal(
        (
          await f.call('/api/auth/login', {
            username: 'unknown',
            password: 'wrong',
          })
        ).status,
        401,
      );
    assert.equal(
      (
        await f.call('/api/auth/login', {
          username: 'unknown',
          password: 'wrong',
        })
      ).status,
      429,
    );
  } finally {
    await f.close();
  }
});
test('Migrace jsou opakovatelné, demo seed nezmění existující práci', async () => {
  const db = await fixture();
  try {
    const count = db.prepare('SELECT COUNT(*) AS n FROM orders').get()!.n;
    await seedDemo(db);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get()!.n, count);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get()!.n, 2);
  } finally {
    db.close();
  }
});
test('Přerušený demo seed nezanechá částečné účty ani práci; lze jej opakovat', async () => {
  const db = openDb(':memory:');
  try {
    db.exec(
      "CREATE TRIGGER fail_seed BEFORE INSERT ON orders BEGIN SELECT RAISE(ABORT,'test_failure'); END;",
    );
    await assert.rejects(() => seedDemo(db), /test_failure/);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get()!.n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM employees').get()!.n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audit_events').get()!.n, 0);
    assert.equal(db.prepare("SELECT key FROM settings WHERE key='demo'").get(), undefined);
    db.exec('DROP TRIGGER fail_seed');
    await seedDemo(db);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get()!.n, 4);
    assert.throws(
      () =>
        db
          .prepare('UPDATE orders SET ends_at=ends_at+1000 WHERE id=?')
          .run(db.prepare('SELECT id FROM orders LIMIT 1').get()!.id),
      /order_has_reservations/,
    );
  } finally {
    db.close();
  }
});

test('Provozní moduly nejsou v říjnovém API dostupné ani dispečerovi', async () => {
  const f = await httpFixture();
  try {
    const a = await f.login();
    const d = await f.login('ridic');
    const count = f.db.prepare('SELECT COUNT(*) AS n FROM orders').get()!.n;
    for (const session of [a, d]) {
      for (const path of [
        '/api/audit',
        '/api/orders/demo',
        '/api/orders',
        '/api/vehicles',
        '/api/trailers',
      ]) {
        assert.equal((await f.call(path, undefined, session.cookie)).status, 404, path);
      }
      assert.equal(
        (await f.call('/api/reservations', {}, session.cookie, session.csrf)).status,
        404,
      );
      for (const field of ['orders', 'vehicles', 'trailers', 'stats']) {
        assert.equal(field in session.data, false, field);
      }
    }
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM orders').get()!.n, count);
    assert.equal((await f.call('/api/users', undefined, a.cookie)).status, 200);
    assert.equal(a.data.employees.length, 3);
  } finally {
    await f.close();
  }
});
