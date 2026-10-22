import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { audit, transaction, type Db } from './db.js';
import { DomainError } from './errors.js';
export { DomainError } from './errors.js';
export const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) =>
  a.start < b.end && b.start < a.end;
const instant = z.iso
  .datetime({ offset: true })
  .transform((v) => Date.parse(v))
  .refine(Number.isFinite, 'Neplatný čas.');
export const reservationInput = z
  .object({
    pickup: z.string().trim().min(2).max(160),
    delivery: z.string().trim().min(2).max(160),
    startsAt: instant,
    endsAt: instant,
    employeeId: z.string().min(1),
    vehicleId: z.string().min(1),
    trailerId: z.string().min(1).nullable(),
    requiresCrane: z.boolean(),
    requiresTrailer: z.boolean(),
    weightKg: z.number().int().positive().max(100000).nullable(),
    approvedCapacityKg: z.number().int().positive().max(100000).nullable(),
    note: z.string().trim().max(1000).default(''),
  })
  .refine((v) => v.endsAt > v.startsAt, {
    message: 'Konec musí být po začátku.',
    path: ['endsAt'],
  });
export function createReservation(
  db: Db,
  input: z.infer<typeof reservationInput>,
  actor: { id: string; username: string },
  correlationId?: string,
) {
  return transaction(db, () => {
    const { employeeId, vehicleId, trailerId, startsAt, endsAt } = input;
    const employee = db
      .prepare('SELECT * FROM employees WHERE id=? AND active=1 AND archived_at IS NULL')
      .get(employeeId);
    const vehicle = db
      .prepare('SELECT * FROM vehicles WHERE id=? AND active=1 AND archived_at IS NULL')
      .get(vehicleId);
    if (!employee || !vehicle) throw new DomainError(422, 'Vyberte aktivního řidiče a tahač.');
    if (
      trailerId &&
      !db
        .prepare('SELECT id FROM trailers WHERE id=? AND active=1 AND archived_at IS NULL')
        .get(trailerId)
    )
      throw new DomainError(422, 'Návěs není dostupný.');
    if (input.requiresTrailer && !trailerId)
      throw new DomainError(422, 'Tato přeprava vyžaduje návěs.');
    if (input.requiresCrane && !vehicle.crane)
      throw new DomainError(422, 'Vybraný tahač nemá hydraulickou ruku.');
    if (input.weightKg && (!input.approvedCapacityKg || input.approvedCapacityKg < input.weightKg))
      throw new DomainError(422, 'Schválená kapacita soupravy musí pokrýt hmotnost nákladu.');
    if (
      db
        .prepare('SELECT id FROM absences WHERE employee_id=? AND starts_at<? AND ends_at>?')
        .get(employeeId, endsAt, startsAt)
    )
      throw new DomainError(409, 'Řidič je v tomto termínu nepřítomný.');
    if (
      db
        .prepare(
          'SELECT id FROM downtimes WHERE (vehicle_id=? OR trailer_id=?) AND starts_at<? AND (ends_at IS NULL OR ends_at>?)',
        )
        .get(vehicleId, trailerId, endsAt, startsAt)
    )
      throw new DomainError(409, 'Technika má v tomto termínu odstávku.');
    const conflict = db
      .prepare(
        `SELECT o.number FROM reservations r JOIN orders o ON o.id=r.order_id
   WHERE (r.employee_id=? OR r.vehicle_id=? OR r.trailer_id=?) AND (r.starts_at<? AND r.ends_at>? OR o.status='in_progress' AND o.starts_at<?) LIMIT 1`,
      )
      .get(employeeId, vehicleId, trailerId, endsAt, startsAt, endsAt);
    if (conflict)
      throw new DomainError(
        409,
        `Termín koliduje s prací ${conflict.number}. Vyberte jiný čas nebo soupravu.`,
      );
    const id = randomUUID();
    const sequence = Number(db.prepare('SELECT COUNT(*)+1 AS n FROM orders').get()!.n);
    const number = `F-${new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Prague' }).format(startsAt)}-${String(sequence).padStart(3, '0')}`;
    db.prepare(
      `INSERT INTO orders (id,number,pickup,delivery,starts_at,ends_at,status,employee_id,vehicle_id,trailer_id,requires_crane,requires_trailer,weight_kg,approved_capacity_kg,note,approved_by) VALUES (?,?,?,?,?,?,'planned',?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      number,
      input.pickup,
      input.delivery,
      startsAt,
      endsAt,
      employeeId,
      vehicleId,
      trailerId,
      +input.requiresCrane,
      +input.requiresTrailer,
      input.weightKg,
      input.approvedCapacityKg,
      input.note,
      actor.id,
    );
    for (const [column, resource] of [
      ['employee_id', employeeId],
      ['vehicle_id', vehicleId],
      ['trailer_id', trailerId],
    ]) {
      if (resource)
        db.prepare(
          `INSERT INTO reservations (id,order_id,${column},starts_at,ends_at) VALUES (?,?,?,?,?)`,
        ).run(randomUUID(), id, resource, startsAt, endsAt);
    }
    db.prepare('INSERT INTO order_status_events VALUES (?,?,NULL,?,?,?)').run(
      randomUUID(),
      id,
      'planned',
      actor.id,
      Date.now(),
    );
    audit(db, actor, 'reservation.created', 'order', id, null, { number, ...input }, correlationId);
    db.prepare('INSERT INTO outbox_events VALUES (?,?,?,?,NULL,?)').run(
      randomUUID(),
      'order.assigned',
      JSON.stringify({ orderId: id, employeeId }),
      Date.now(),
      `order.assigned:${id}`,
    );
    return { id, number };
  });
}
