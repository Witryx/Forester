import type { Express, Request, RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { audit, type Store, type Row } from './store.js';
import { DomainError } from './errors.js';
import type { Availability, Fleet } from '../shared/types.js';

const name = z.string().trim().min(1).max(80);
const note = z.string().trim().max(2000).default('');
const version = z.number().int().positive();
const positive = z.number().int().positive().max(200000).nullable();
const driverInput = z.object({
  firstName: name,
  lastName: name,
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s().-]*$/, 'Zkontrolujte telefonní číslo.')
    .default(''),
  email: z
    .union([z.email().max(254), z.literal('')])
    .nullable()
    .default(null),
  status: z.enum(['available', 'vacation', 'sick', 'off_duty', 'inactive']),
  note,
});
const equipmentInput = z.object({
  plate: z
    .string()
    .trim()
    .toUpperCase()
    .min(3)
    .max(20)
    .transform((v) => v.replace(/\s+/g, ' ')),
  manufacturer: name,
  model: name,
  year: z
    .number()
    .int()
    .min(1950)
    .max(new Date().getFullYear() + 1)
    .nullable(),
  capacityKg: positive,
  kind: z.enum(['timber', 'universal', 'other']),
  status: z.enum(['available', 'service', 'out_of_service', 'inactive']),
  note,
});
const photo = z
  .string()
  .max(700000)
  .refine((value) => {
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) return false;
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > 500000 || bytes.length < 12) return false;
    return match[1] === 'jpeg'
      ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      : match[1] === 'png'
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  }, 'Fotografie musí být JPG, PNG nebo WebP do 500 kB.');
const vehicleInput = equipmentInput.extend({
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^$|^[A-HJ-NPR-Z0-9]{17}$/, 'VIN musí mít 17 platných znaků.')
    .nullable(),
  odometerKm: z.number().int().min(0).max(10000000).nullable(),
  crane: z.boolean(),
  photos: z.array(photo).max(4),
});

async function nextCode(db: Store) {
  const highest = (await db.prepare('SELECT code FROM employees').all()).reduce((max, row) => {
    const match = /^ZAM-(\d+)$/.exec(String(row.code));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `ZAM-${String(highest + 1).padStart(3, '0')}`;
}

export async function getFleet(db: Store): Promise<Fleet> {
  // Read one consistent snapshot, including assignments and the availability at this instant.
  const now = Date.now();
  const drivers = await db
    .prepare('SELECT * FROM employees WHERE archived_at IS NULL ORDER BY last_name,first_name')
    .all();
  const vehicles = await db
    .prepare('SELECT * FROM vehicles WHERE archived_at IS NULL ORDER BY plate')
    .all();
  const trailers = await db
    .prepare('SELECT * FROM trailers WHERE archived_at IS NULL ORDER BY plate')
    .all();
  const assignments = await db
    .prepare(
      'SELECT * FROM default_assignments WHERE starts_at<=? AND (ends_at IS NULL OR ends_at>?)',
    )
    .all(now, now);
  const absences = await db
    .prepare('SELECT * FROM absences WHERE starts_at<=? AND ends_at>?')
    .all(now, now);
  const downtimes = await db
    .prepare('SELECT * FROM downtimes WHERE starts_at<=? AND (ends_at IS NULL OR ends_at>?)')
    .all(now, now);
  const reservations = await db
    .prepare(
      "SELECT r.* FROM reservations r JOIN orders o ON o.id=r.order_id WHERE r.starts_at<=? AND (r.ends_at>? OR o.status='in_progress')",
    )
    .all(now, now);
  function availability(row: Row, key: string): Availability {
    if (!row.active) return 'inactive';
    if (row.status !== 'available') return row.status as Availability;
    const block = (key === 'employee_id' ? absences : downtimes).find(
      (item) => item[key] === row.id,
    );
    if (block) return block.kind as Availability;
    if (reservations.some((item) => item[key] === row.id)) return 'busy';
    return assignments.some((item) => item[key] === row.id) ? 'assigned' : 'available';
  }
  return {
    drivers: drivers.map((row) => ({ ...row, availability: availability(row, 'employee_id') })),
    vehicles: vehicles.map(({ photos_json, photo_key: _legacyPhoto, ...row }) => ({
      ...row,
      photo_count: (JSON.parse(String(photos_json)) as string[]).length,
      availability: availability(row, 'vehicle_id'),
    })),
    trailers: trailers.map((row) => ({ ...row, availability: availability(row, 'trailer_id') })),
    assignments,
    fetchedAt: now,
  } as unknown as Fleet;
}

export function registerFleet(
  app: Express,
  db: Store,
  dispatcher: RequestHandler,
  reauthorize: (req: Request, admin?: boolean) => Promise<void>,
) {
  const snapshot = () => db.transaction(() => getFleet(db));
  app.get('/api/fleet', dispatcher, async (_req, res) => res.json(await snapshot()));
  app.get('/api/drivers', dispatcher, async (_req, res) => res.json((await snapshot()).drivers));
  app.get('/api/vehicles', dispatcher, async (_req, res) => res.json((await snapshot()).vehicles));
  app.get('/api/trailers', dispatcher, async (_req, res) => res.json((await snapshot()).trailers));
  for (const [route, table, key] of [
    ['drivers', 'employees', 'employee_id'],
    ['vehicles', 'vehicles', 'vehicle_id'],
    ['trailers', 'trailers', 'trailer_id'],
  ] as const) {
    app.get(`/api/${route}/:id`, dispatcher, async (req, res) => {
      const result = await db.transaction(async () => {
        const fleet = await getFleet(db);
        const row = fleet[route].find((item) => item.id === req.params.id);
        if (!row) throw new DomainError(404, 'Záznam nebyl nalezen.');
        const history = await db
          .prepare(
            `SELECT a.*,e.first_name,e.last_name,v.plate,t.plate AS trailer_plate
          FROM default_assignments a JOIN employees e ON e.id=a.employee_id
          JOIN vehicles v ON v.id=a.vehicle_id LEFT JOIN trailers t ON t.id=a.trailer_id
          WHERE a.${key}=? ORDER BY a.starts_at DESC LIMIT 20`,
          )
          .all(req.params.id);
        const photos =
          table === 'vehicles'
            ? JSON.parse(
                String(
                  (await db
                    .prepare('SELECT photos_json FROM vehicles WHERE id=?')
                    .get(req.params.id))!.photos_json,
                ),
              )
            : undefined;
        return { ...row, history, ...(photos && { photos }) };
      });
      res.json(result);
    });
    app.post(`/api/${route}`, dispatcher, async (req, res) => {
      const input = (
        route === 'drivers' ? driverInput : route === 'vehicles' ? vehicleInput : equipmentInput
      ).parse(req.body);
      const id = randomUUID();
      await db.transaction(async () => {
        await reauthorize(req, true);
        await write(table, id, input, false);
        await record(req, `${route}.created`, table, id, null);
      });
      res.status(201).json({ id });
    });
    app.patch(`/api/${route}/:id`, dispatcher, async (req, res) => {
      const input = (
        route === 'drivers' ? driverInput : route === 'vehicles' ? vehicleInput : equipmentInput
      ).parse(req.body);
      const expected = version.parse(req.body.version);
      await db.transaction(async () => {
        await reauthorize(req, true);
        const old = await db
          .prepare(`SELECT * FROM ${table} WHERE id=? AND archived_at IS NULL`)
          .get(req.params.id);
        if (!old) throw new DomainError(404, 'Záznam nebyl nalezen.');
        if (old.version !== expected)
          throw new DomainError(
            409,
            'Záznam mezitím změnil jiný dispečer. Zavřete formulář a načtěte aktuální stav.',
          );
        await write(table, String(old.id), input, true);
        if (input.status === 'inactive') {
          await endAssignments(key, String(old.id));
          if (table === 'employees') {
            await db
              .prepare(
                "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE employee_id=? AND role='driver')",
              )
              .run(old.id);
            await db
              .prepare(
                "UPDATE users SET active=0,session_version=session_version+1,version=version+1 WHERE employee_id=? AND role='driver'",
              )
              .run(old.id);
          }
        }
        await record(req, `${route}.updated`, table, String(old.id), old);
      });
      res.json({ ok: true });
    });
  }
  app.get('/api/vehicles/:id/photos/:index', dispatcher, async (req, res) => {
    const row = await db
      .prepare('SELECT photos_json FROM vehicles WHERE id=? AND archived_at IS NULL')
      .get(req.params.id);
    const index = /^\d$/.test(String(req.params.index)) ? Number(req.params.index) : -1;
    const data = row ? (JSON.parse(String(row.photos_json)) as string[])[index] : undefined;
    if (!data) throw new DomainError(404, 'Fotografie nebyla nalezena.');
    const [header, encoded] = data.split(',');
    res.type(header.slice(5, header.indexOf(';'))).send(Buffer.from(encoded, 'base64'));
  });
  app.put('/api/drivers/:id/assignment', dispatcher, async (req, res) => {
    const input = z
      .object({
        vehicleId: z.string().min(1).nullable(),
        trailerId: z.string().min(1).nullable(),
        version,
      })
      .refine((v) => v.vehicleId || !v.trailerId, 'Návěs lze přiřadit pouze společně s tahačem.')
      .parse(req.body);
    await db.transaction(async () => {
      await reauthorize(req, true);
      const driver = await db
        .prepare('SELECT * FROM employees WHERE id=? AND archived_at IS NULL')
        .get(req.params.id);
      if (!driver) throw new DomainError(404, 'Řidič nebyl nalezen.');
      if (driver.version !== input.version)
        throw new DomainError(
          409,
          'Souprava nebo řidič se mezitím změnili. Načtěte aktuální stav.',
        );
      const now = Date.now();
      if (input.vehicleId) {
        for (const [table, id, key] of [
          ['employees', driver.id, 'employee_id'],
          ['vehicles', input.vehicleId, 'vehicle_id'],
          ['trailers', input.trailerId, 'trailer_id'],
        ] as const) {
          if (!id) continue;
          const row = await db
            .prepare(`SELECT * FROM ${table} WHERE id=? AND archived_at IS NULL`)
            .get(id);
          if (!row?.active || row.status !== 'available')
            throw new DomainError(422, 'Řidič i technika musí být v dostupném stavu.');
          const blocked =
            table === 'employees'
              ? await db
                  .prepare(
                    'SELECT id FROM absences WHERE employee_id=? AND starts_at<=? AND ends_at>?',
                  )
                  .get(id, now, now)
              : await db
                  .prepare(
                    `SELECT id FROM downtimes WHERE ${key}=? AND starts_at<=? AND (ends_at IS NULL OR ends_at>?)`,
                  )
                  .get(id, now, now);
          if (blocked)
            throw new DomainError(
              422,
              'Řidič nebo technika mají právě evidovanou nepřítomnost nebo odstávku.',
            );
          if (table !== 'employees') {
            if (
              await db
                .prepare(
                  `SELECT id FROM default_assignments WHERE ${key}=? AND ends_at IS NULL AND employee_id<>?`,
                )
                .get(id, driver.id)
            )
              throw new DomainError(
                409,
                'Technika je již přiřazená jinému řidiči. Nejprve ukončete jeho přiřazení.',
              );
            if (
              await db
                .prepare(
                  `SELECT r.id FROM reservations r JOIN orders o ON o.id=r.order_id WHERE r.${key}=? AND r.starts_at<=? AND (r.ends_at>? OR o.status='in_progress') AND o.employee_id<>?`,
                )
                .get(id, now, now, driver.id)
            )
              throw new DomainError(409, 'Techniku právě používá jiný řidič v přepravě.');
          }
        }
      }
      const old = await db
        .prepare('SELECT * FROM default_assignments WHERE employee_id=? AND ends_at IS NULL')
        .get(driver.id);
      if (
        (old?.vehicle_id ?? null) === input.vehicleId &&
        (old?.trailer_id ?? null) === input.trailerId
      )
        return;
      const startsAt = await endAssignments('employee_id', String(driver.id));
      let next = null;
      if (input.vehicleId) {
        next = {
          id: randomUUID(),
          employee_id: driver.id,
          vehicle_id: input.vehicleId,
          trailer_id: input.trailerId,
          starts_at: startsAt,
        };
        await db
          .prepare(
            'INSERT INTO default_assignments (id,employee_id,vehicle_id,trailer_id,starts_at) VALUES (?,?,?,?,?)',
          )
          .run(next.id, driver.id, input.vehicleId, input.trailerId, startsAt);
        await db.prepare('UPDATE vehicles SET version=version+1 WHERE id=?').run(input.vehicleId);
        if (input.trailerId)
          await db.prepare('UPDATE trailers SET version=version+1 WHERE id=?').run(input.trailerId);
      }
      await db.prepare('UPDATE employees SET version=version+1 WHERE id=?').run(driver.id);
      await audit(
        db,
        req.user,
        'assignment.updated',
        'employee',
        String(driver.id),
        old ?? null,
        next,
        req.correlationId,
      );
    });
    res.json({ ok: true });
  });

  async function endAssignments(key: string, id: string) {
    const rows = await db
      .prepare(`SELECT * FROM default_assignments WHERE ${key}=? AND ends_at IS NULL`)
      .all(id);
    const at = Math.max(Date.now(), ...rows.map((row) => Number(row.starts_at) + 1));
    for (const row of rows) {
      await db.prepare('UPDATE default_assignments SET ends_at=? WHERE id=?').run(at, row.id);
      // Related editors must detect assignment changes too.
      await db.prepare('UPDATE employees SET version=version+1 WHERE id=?').run(row.employee_id);
      await db.prepare('UPDATE vehicles SET version=version+1 WHERE id=?').run(row.vehicle_id);
      if (row.trailer_id)
        await db.prepare('UPDATE trailers SET version=version+1 WHERE id=?').run(row.trailer_id);
    }
    return at;
  }
  async function record(
    req: Request,
    action: string,
    table: string,
    id: string,
    before: Row | null,
  ) {
    const strip = (row: Row | null) =>
      row && {
        ...Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'photos_json')),
        ...(typeof row.photos_json === 'string' && {
          photo_count: (JSON.parse(row.photos_json) as string[]).length,
        }),
      };
    const after = (await db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id))!;
    await audit(db, req.user, action, table, id, strip(before), strip(after), req.correlationId);
  }
  async function write(table: string, id: string, input: unknown, updating: boolean) {
    let values: Record<string, unknown>;
    if (table === 'employees') {
      const data = input as z.infer<typeof driverInput>;
      values = {
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        email: data.email || null,
        status: data.status,
        active: +(data.status !== 'inactive'),
        note: data.note,
      };
      if (!updating) values.code = await nextCode(db);
    } else {
      const data = input as z.infer<typeof vehicleInput>;
      values = {
        plate: data.plate,
        manufacturer: data.manufacturer,
        model: data.model,
        year: data.year,
        capacity_kg: data.capacityKg,
        kind: data.kind,
        status: data.status,
        active: +(data.status !== 'inactive'),
        note: data.note,
      };
      // Plates are unique across the whole fleet, ignoring spaces and case.
      for (const other of ['vehicles', 'trailers']) {
        const duplicate = await db
          .prepare(`SELECT id FROM ${other} WHERE REPLACE(UPPER(plate),' ','')=? AND id<>?`)
          .get(data.plate.replaceAll(' ', ''), id);
        if (duplicate)
          throw new DomainError(409, 'Tato registrační značka již ve vozovém parku existuje.');
      }
      if (table === 'vehicles')
        Object.assign(values, {
          vin: data.vin || null,
          odometer_km: data.odometerKm,
          crane: +data.crane,
          photos_json: JSON.stringify(data.photos),
        });
    }
    const columns = Object.keys(values);
    if (updating)
      await db
        .prepare(
          `UPDATE ${table} SET ${columns.map((key) => `${key}=?`).join(',')},version=version+1 WHERE id=?`,
        )
        .run(...Object.values(values), id);
    else
      await db
        .prepare(
          `INSERT INTO ${table} (id,${columns.join(',')}) VALUES (${['?', ...columns.map(() => '?')].join(',')})`,
        )
        .run(id, ...Object.values(values));
  }
}
