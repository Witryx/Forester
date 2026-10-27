import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Store } from '../server/store';
import type { Fleet, Driver, FleetVehicle } from '../shared/types';

type Fixture = {
  db: Store;
  call: (
    path: string,
    body?: unknown,
    cookie?: string,
    csrf?: string,
    method?: string,
  ) => Promise<Response>;
  login: (
    username?: string,
    password?: string,
  ) => Promise<{ cookie: string; csrf: string; data: { user: { id: string; version: number } } }>;
  close: () => Promise<void>;
};
export const driverBody = {
  firstName: 'Jana',
  lastName: 'Nová',
  phone: '+420 777 111 222',
  email: 'jana@example.test',
  status: 'available',
  note: 'Řidič lesní soupravy',
};
export const vehicleBody = {
  plate: '1AB 2345',
  manufacturer: 'Scania',
  model: 'R 540',
  year: 2022,
  capacityKg: 26000,
  kind: 'timber',
  status: 'available',
  note: '',
  vin: 'YS2R4X20001234567',
  odometerKm: 150000,
  crane: true,
  photos: [] as string[],
};
export const trailerBody = {
  plate: '2AB 3456',
  manufacturer: 'DOLL',
  model: 'Logo 21',
  year: 2021,
  capacityKg: 26000,
  kind: 'timber',
  status: 'available',
  note: '',
};

export function fleetContract(label: string, fixture: () => Promise<Fixture>) {
  test(`${label}: správa řidičů a techniky, validace, verze a audit`, async () => {
    const f = await fixture();
    try {
      const a = await f.login();
      const create = async (path: string, body: unknown) => {
        const response = await f.call(path, body, a.cookie, a.csrf);
        assert.equal(response.status, 201, await response.clone().text());
        return ((await response.json()) as { id: string }).id;
      };
      const driverId = await create('/api/drivers', driverBody);
      const vehicleId = await create('/api/vehicles', vehicleBody);
      const trailerId = await create('/api/trailers', trailerBody);
      let fleet = (await (await f.call('/api/fleet', undefined, a.cookie)).json()) as Fleet;
      assert.equal(fleet.drivers.find((d) => d.id === driverId)?.availability, 'available');
      assert.equal(fleet.vehicles.find((v) => v.id === vehicleId)?.capacity_kg, 26000);
      const detail = (await (
        await f.call(`/api/drivers/${driverId}`, undefined, a.cookie)
      ).json()) as Driver;
      assert.equal(detail.email, driverBody.email);
      assert.equal(detail.code, 'ZAM-001');
      assert.equal(
        (await f.call('/api/drivers', { ...driverBody, firstName: ' ' }, a.cookie, a.csrf)).status,
        422,
      );
      assert.equal(
        (await f.call('/api/vehicles', { ...vehicleBody, vin: 'bad' }, a.cookie, a.csrf)).status,
        422,
      );
      assert.equal(
        (
          await f.call(
            '/api/vehicles',
            { ...vehicleBody, plate: 'NEW 123', capacityKg: -1 },
            a.cookie,
            a.csrf,
          )
        ).status,
        422,
      );
      assert.equal(
        (await f.call('/api/trailers', { ...trailerBody, plate: '1ab2345' }, a.cookie, a.csrf))
          .status,
        409,
      );
      assert.equal(
        (await f.call('/api/vehicles', { ...vehicleBody, plate: '3AB 4567' }, a.cookie, a.csrf))
          .status,
        409,
        'Duplicate VIN',
      );
      for (const path of ['/api/drivers/missing', '/api/vehicles/missing', '/api/trailers/missing'])
        assert.equal((await f.call(path, undefined, a.cookie)).status, 404);
      const edit = {
        ...driverBody,
        firstName: 'Ivana',
        status: 'vacation',
        version: detail.version,
      };
      assert.equal(
        (await f.call(`/api/drivers/${driverId}`, edit, a.cookie, a.csrf, 'PATCH')).status,
        200,
      );
      assert.equal(
        (
          await f.call(
            `/api/drivers/${driverId}`,
            { ...edit, firstName: 'Přepsáno' },
            a.cookie,
            a.csrf,
            'PATCH',
          )
        ).status,
        409,
      );
      const next = (await (
        await f.call(`/api/drivers/${driverId}`, undefined, a.cookie)
      ).json()) as Driver;
      assert.equal(next.first_name, 'Ivana');
      assert.equal(next.availability, 'vacation');
      assert.equal(
        (
          await f.call(
            `/api/vehicles/${vehicleId}`,
            { ...vehicleBody, status: 'service', version: 1 },
            a.cookie,
            a.csrf,
            'PATCH',
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await f.call(
            `/api/trailers/${trailerId}`,
            { ...trailerBody, status: 'out_of_service', version: 1 },
            a.cookie,
            a.csrf,
            'PATCH',
          )
        ).status,
        200,
      );
      fleet = (await (await f.call('/api/fleet', undefined, a.cookie)).json()) as Fleet;
      assert.equal(fleet.vehicles[0].availability, 'service');
      assert.equal(fleet.trailers[0].availability, 'out_of_service');
      const events = await f.db
        .prepare('SELECT action FROM audit_events WHERE entity_id=?')
        .all(driverId);
      assert.deepEqual(
        events.map((e) => e.action),
        ['drivers.created', 'drivers.updated'],
      );
    } finally {
      await f.close();
    }
  });

  test(`${label}: soupravy jsou výlučné, souběžné změny atomické a historie zachovaná`, async () => {
    const f = await fixture();
    try {
      const a = await f.login();
      const create = async (path: string, body: unknown) =>
        ((await (await f.call(path, body, a.cookie, a.csrf)).json()) as { id: string }).id;
      const first = await create('/api/drivers', driverBody);
      const second = await create('/api/drivers', { ...driverBody, firstName: 'Pavel' });
      const vehicle = await create('/api/vehicles', vehicleBody);
      const trailer = await create('/api/trailers', trailerBody);
      const assign = (
        id: string,
        vehicleId: string | null,
        trailerId: string | null,
        version: number,
      ) =>
        f.call(
          `/api/drivers/${id}/assignment`,
          { vehicleId, trailerId, version },
          a.cookie,
          a.csrf,
          'PUT',
        );
      const results = await Promise.all([
        assign(first, vehicle, trailer, 1),
        assign(second, vehicle, trailer, 1),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      let fleet = (await (await f.call('/api/fleet', undefined, a.cookie)).json()) as Fleet;
      assert.equal(fleet.assignments.length, 1);
      const owner = fleet.assignments[0].employee_id;
      const other = owner === first ? second : first;
      const ownerVersion = fleet.drivers.find((d) => d.id === owner)!.version;
      assert.equal(fleet.vehicles[0].availability, 'assigned');
      assert.equal(fleet.trailers[0].availability, 'assigned');
      assert.equal((await assign(owner, null, null, 1)).status, 409, 'stale editor');
      assert.equal((await assign(other, null, trailer, 1)).status, 422, 'trailer requires tractor');
      const otherVehicle = await create('/api/vehicles', {
        ...vehicleBody,
        plate: '3CD 9999',
        vin: null,
      });
      assert.equal(
        (await assign(other, otherVehicle, trailer, 1)).status,
        409,
        'trailer conflict rolls everything back',
      );
      assert.equal(
        (await f.db
          .prepare('SELECT COUNT(*) AS n FROM default_assignments WHERE ends_at IS NULL')
          .get())!.n,
        1,
      );
      assert.equal((await assign(owner, vehicle, null, ownerVersion)).status, 200);
      fleet = (await (await f.call('/api/fleet', undefined, a.cookie)).json()) as Fleet;
      assert.equal(fleet.assignments.length, 1);
      assert.equal(fleet.assignments[0].trailer_id, null);
      assert.equal(fleet.trailers[0].availability, 'available');
      const history = (await (
        await f.call(`/api/drivers/${owner}`, undefined, a.cookie)
      ).json()) as { history: { ends_at: number | null; starts_at: number }[] };
      assert.equal(history.history.length, 2);
      assert(history.history.filter((h) => h.ends_at).every((h) => h.ends_at! > h.starts_at));
      const latest = fleet.drivers.find((d) => d.id === owner)!;
      assert.equal((await assign(owner, null, null, latest.version)).status, 200);
      assert.equal(
        (await f.db
          .prepare('SELECT COUNT(*) AS n FROM default_assignments WHERE ends_at IS NULL')
          .get())!.n,
        0,
      );
      // An inactive driver cannot acquire equipment.
      const now = (await (await f.call('/api/fleet', undefined, a.cookie)).json()) as Fleet;
      const inactive = {
        ...driverBody,
        status: 'inactive',
        version: now.drivers.find((d) => d.id === owner)!.version,
      };
      assert.equal(
        (await f.call(`/api/drivers/${owner}`, inactive, a.cookie, a.csrf, 'PATCH')).status,
        200,
      );
      assert.equal((await assign(owner, vehicle, trailer, inactive.version + 1)).status, 422);
    } finally {
      await f.close();
    }
  });

  test(`${label}: odstávky a rozpracovaná přeprava mají přednost před volnou technikou`, async () => {
    const f = await fixture();
    try {
      const a = await f.login();
      const create = async (path: string, body: unknown) =>
        ((await (await f.call(path, body, a.cookie, a.csrf)).json()) as { id: string }).id;
      const first = await create('/api/drivers', driverBody);
      const second = await create('/api/drivers', { ...driverBody, firstName: 'Pavel' });
      const vehicle = await create('/api/vehicles', vehicleBody);
      const trailer = await create('/api/trailers', trailerBody);
      const now = Date.now();
      await f.db
        .prepare(
          "INSERT INTO orders (id,number,pickup,delivery,starts_at,ends_at,status,employee_id,vehicle_id,trailer_id) VALUES ('work','QA-1','Les','Pila',?,?,'planned',?,?,?)",
        )
        .run(now - 20000, now - 10000, first, vehicle, trailer);
      for (const [key, id] of [
        ['employee_id', first],
        ['vehicle_id', vehicle],
        ['trailer_id', trailer],
      ]) {
        await f.db
          .prepare(
            `INSERT INTO reservations (id,order_id,${key},starts_at,ends_at) VALUES (?,'work',?,?,?)`,
          )
          .run(`reservation-${key}`, id, now - 20000, now - 10000);
      }
      await f.db.prepare("UPDATE orders SET status='in_progress' WHERE id='work'").run();
      let fleet = (await (await f.call('/api/fleet', undefined, a.cookie)).json()) as Fleet;
      assert.equal(fleet.vehicles[0].availability, 'busy');
      assert.equal(fleet.trailers[0].availability, 'busy');
      assert.equal(fleet.drivers.find((d) => d.id === first)!.availability, 'busy');
      assert.equal(
        (
          await f.call(
            `/api/drivers/${second}/assignment`,
            { vehicleId: vehicle, trailerId: trailer, version: 1 },
            a.cookie,
            a.csrf,
            'PUT',
          )
        ).status,
        409,
      );
      await f.db
        .prepare(
          "INSERT INTO downtimes (id,vehicle_id,kind,starts_at,reason) VALUES ('downtime',?,'service',?,'Oprava')",
        )
        .run(vehicle, now - 1000);
      fleet = (await (await f.call('/api/fleet', undefined, a.cookie)).json()) as Fleet;
      assert.equal(fleet.vehicles[0].availability, 'service');
      assert.equal(
        (
          await f.call(
            `/api/drivers/${second}/assignment`,
            { vehicleId: vehicle, trailerId: null, version: 1 },
            a.cookie,
            a.csrf,
            'PUT',
          )
        ).status,
        422,
      );
      assert.equal(
        (await f.db.prepare('SELECT COUNT(*) AS n FROM default_assignments').get())!.n,
        0,
      );
    } finally {
      await f.close();
    }
  });

  test(`${label}: fotografie jsou trvalé, chráněné a neunikají do seznamu ani auditu`, async () => {
    const f = await fixture();
    try {
      const a = await f.login();
      const png =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
      const created = await f.call(
        '/api/vehicles',
        { ...vehicleBody, photos: [png] },
        a.cookie,
        a.csrf,
      );
      assert.equal(created.status, 201);
      const { id } = (await created.json()) as { id: string };
      const list = (await (
        await f.call('/api/vehicles', undefined, a.cookie)
      ).json()) as FleetVehicle[];
      assert.equal(list[0].photo_count, 1);
      assert(!JSON.stringify(list).includes('base64'));
      const detail = (await (await f.call(`/api/vehicles/${id}`, undefined, a.cookie)).json()) as {
        photos: string[];
      };
      assert.deepEqual(detail.photos, [png]);
      const image = await f.call(`/api/vehicles/${id}/photos/0`, undefined, a.cookie);
      assert.equal(image.status, 200);
      assert.match(image.headers.get('content-type')!, /image\/png/);
      assert.deepEqual(
        Buffer.from(await image.arrayBuffer()),
        Buffer.from(png.split(',')[1], 'base64'),
      );
      assert.equal((await f.call(`/api/vehicles/${id}/photos/1`, undefined, a.cookie)).status, 404);
      assert.equal((await f.call(`/api/vehicles/${id}/photos/0`)).status, 401);
      for (const photos of [
        ['data:image/svg+xml;base64,PHN2Zz4='],
        ['data:image/jpeg;base64,YWJjZGVmZ2hpamts'],
        Array(5).fill(png),
      ]) {
        assert.equal(
          (await f.call('/api/vehicles', { ...vehicleBody, photos }, a.cookie, a.csrf)).status,
          422,
        );
      }
      assert(
        !JSON.stringify(await f.db.prepare('SELECT * FROM audit_events').all()).includes('base64'),
      );
      assert.equal(
        (
          await f.call(
            `/api/vehicles/${id}`,
            { ...vehicleBody, photos: [], version: 1 },
            a.cookie,
            a.csrf,
            'PATCH',
          )
        ).status,
        200,
      );
      assert.equal((await f.call(`/api/vehicles/${id}/photos/0`, undefined, a.cookie)).status, 404);
    } finally {
      await f.close();
    }
  });

  test(`${label}: role, CSRF, nepřítomnost a deaktivace propojeného účtu`, async () => {
    const f = await fixture();
    try {
      const a = await f.login();
      const created = await f.call('/api/drivers', driverBody, a.cookie, a.csrf);
      const { id } = (await created.json()) as { id: string };
      assert.equal((await f.call('/api/drivers', driverBody, a.cookie)).status, 403);
      assert.equal(
        (
          await f.call(
            '/api/users',
            {
              username: 'jana.nova',
              displayName: 'Jana Nová',
              role: 'driver',
              employeeId: id,
              password: 'TemporaryTest!2026',
            },
            a.cookie,
            a.csrf,
          )
        ).status,
        201,
      );
      const temporary = await f.login('jana.nova', 'TemporaryTest!2026');
      assert.equal(
        (
          await f.call(
            '/api/auth/password',
            { currentPassword: 'TemporaryTest!2026', newPassword: 'PersonalTest!2026' },
            temporary.cookie,
            temporary.csrf,
          )
        ).status,
        200,
      );
      const d = await f.login('jana.nova', 'PersonalTest!2026');
      for (const path of [
        '/api/fleet',
        '/api/drivers',
        `/api/drivers/${id}`,
        '/api/vehicles',
        '/api/trailers',
      ])
        assert.equal((await f.call(path, undefined, d.cookie)).status, 403);
      for (const [path, body, method] of [
        ['/api/drivers', driverBody, 'POST'],
        [`/api/drivers/${id}`, { ...driverBody, version: 1 }, 'PATCH'],
        [`/api/drivers/${id}/assignment`, { vehicleId: null, trailerId: null, version: 1 }, 'PUT'],
        ['/api/vehicles', vehicleBody, 'POST'],
        ['/api/trailers', trailerBody, 'POST'],
      ] as const)
        assert.equal((await f.call(path, body, d.cookie, d.csrf, method)).status, 403);
      const now = Date.now();
      await f.db
        .prepare(
          'INSERT INTO absences (id,employee_id,kind,starts_at,ends_at,actor_id) VALUES (?,?,?,?,?,?)',
        )
        .run('absence-test', id, 'sick', now - 1000, now + 60000, a.data.user.id);
      let fleet = (await (await f.call('/api/fleet', undefined, a.cookie)).json()) as Fleet;
      assert.equal(fleet.drivers[0].availability, 'sick');
      const vehicleId = (
        (await (await f.call('/api/vehicles', vehicleBody, a.cookie, a.csrf)).json()) as {
          id: string;
        }
      ).id;
      assert.equal(
        (
          await f.call(
            `/api/drivers/${id}/assignment`,
            { vehicleId, trailerId: null, version: 1 },
            a.cookie,
            a.csrf,
            'PUT',
          )
        ).status,
        422,
      );
      await f.db.prepare('DELETE FROM absences WHERE id=?').run('absence-test');
      assert.equal(
        (
          await f.call(
            `/api/drivers/${id}/assignment`,
            { vehicleId, trailerId: null, version: 1 },
            a.cookie,
            a.csrf,
            'PUT',
          )
        ).status,
        200,
      );
      fleet = (await (await f.call('/api/fleet', undefined, a.cookie)).json()) as Fleet;
      assert.equal(
        (
          await f.call(
            `/api/drivers/${id}`,
            { ...driverBody, status: 'inactive', version: fleet.drivers[0].version },
            a.cookie,
            a.csrf,
            'PATCH',
          )
        ).status,
        200,
      );
      assert.equal((await f.call('/api/bootstrap', undefined, d.cookie)).status, 401);
      assert.equal(
        (await f.db
          .prepare('SELECT COUNT(*) AS n FROM default_assignments WHERE ends_at IS NULL')
          .get())!.n,
        0,
      );
      assert.equal(
        (await f.call('/api/auth/login', { username: 'jana.nova', password: 'PersonalTest!2026' }))
          .status,
        401,
      );
      const blocked = (await (
        await f.call(`/api/drivers/${id}`, undefined, a.cookie)
      ).json()) as Driver;
      assert.equal(blocked.active, 0);
      assert.equal(blocked.availability, 'inactive');
      assert.equal(
        (
          await f.call(
            `/api/drivers/${id}`,
            { ...driverBody, version: blocked.version },
            a.cookie,
            a.csrf,
            'PATCH',
          )
        ).status,
        200,
      );
      assert.equal(
        (await f.db.prepare('SELECT active FROM users WHERE employee_id=?').get(id))!.active,
        0,
        'profile reactivation never silently restores access',
      );
    } finally {
      await f.close();
    }
  });
}
