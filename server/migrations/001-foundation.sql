CREATE TABLE employees (
 id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '', email TEXT, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), archived_at INTEGER
);
CREATE TABLE users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('dispatcher','driver')), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 employee_id TEXT UNIQUE REFERENCES employees(id), display_name TEXT NOT NULL,
 must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1)),
 session_version INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1,
 CHECK(role != 'driver' OR employee_id IS NOT NULL)
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf_token TEXT NOT NULL,
 session_version INTEGER NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE vehicles (
 id TEXT PRIMARY KEY, plate TEXT NOT NULL UNIQUE, vin TEXT UNIQUE, manufacturer TEXT NOT NULL, model TEXT NOT NULL,
 year INTEGER, kind TEXT NOT NULL DEFAULT 'timber', photo_key TEXT, odometer_km INTEGER CHECK(odometer_km >= 0),
 capacity_kg INTEGER CHECK(capacity_kg > 0), crane INTEGER NOT NULL DEFAULT 0 CHECK(crane IN (0,1)),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), archived_at INTEGER
);
CREATE TABLE trailers (
 id TEXT PRIMARY KEY, plate TEXT NOT NULL UNIQUE, manufacturer TEXT NOT NULL, model TEXT NOT NULL,
 kind TEXT NOT NULL DEFAULT 'timber', capacity_kg INTEGER CHECK(capacity_kg > 0), year INTEGER,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), archived_at INTEGER
);
CREATE TABLE default_assignments (
 id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id), vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
 trailer_id TEXT REFERENCES trailers(id), approved_capacity_kg INTEGER CHECK(approved_capacity_kg > 0),
 starts_at INTEGER NOT NULL, ends_at INTEGER, CHECK(ends_at IS NULL OR ends_at > starts_at)
);
CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT, archived_at INTEGER);
CREATE TABLE forester_contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, note TEXT, archived_at INTEGER);
CREATE TABLE harvesters (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, manufacturer TEXT, model TEXT, meter_milli INTEGER CHECK(meter_milli >= 0), active INTEGER NOT NULL DEFAULT 1, archived_at INTEGER);
CREATE TABLE harvests (
 id TEXT PRIMARY KEY, forest_stand TEXT NOT NULL, forester_id TEXT REFERENCES forester_contacts(id), harvester_id TEXT NOT NULL REFERENCES harvesters(id),
 starts_at INTEGER NOT NULL, ends_at INTEGER, price_per_m3_cents INTEGER CHECK(price_per_m3_cents >= 0), archived_at INTEGER,
 CHECK(ends_at IS NULL OR ends_at > starts_at)
);
CREATE TABLE orders (
 id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, customer_id TEXT REFERENCES customers(id), pickup TEXT NOT NULL, delivery TEXT NOT NULL,
 starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, actual_start INTEGER, actual_end INTEGER,
 status TEXT NOT NULL CHECK(status IN ('waiting','planned','in_progress','completed','cancelled')),
 employee_id TEXT REFERENCES employees(id), vehicle_id TEXT REFERENCES vehicles(id), trailer_id TEXT REFERENCES trailers(id),
 material TEXT NOT NULL DEFAULT 'timber', weight_kg INTEGER CHECK(weight_kg > 0), volume_milli INTEGER CHECK(volume_milli >= 0),
 requires_crane INTEGER NOT NULL DEFAULT 0, requires_trailer INTEGER NOT NULL DEFAULT 0,
 approved_capacity_kg INTEGER CHECK(approved_capacity_kg > 0), price_cents INTEGER CHECK(price_cents >= 0),
 note TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'dispatcher', approved_by TEXT REFERENCES users(id),
 harvest_id TEXT REFERENCES harvests(id), needs_replanning INTEGER NOT NULL DEFAULT 0, archived_at INTEGER, version INTEGER NOT NULL DEFAULT 1,
 CHECK(ends_at > starts_at), CHECK(status IN ('waiting','cancelled') OR (employee_id IS NOT NULL AND vehicle_id IS NOT NULL)),
 CHECK(status IN ('waiting','cancelled') OR requires_trailer = 0 OR trailer_id IS NOT NULL)
);
CREATE INDEX orders_interval ON orders(starts_at, ends_at);
CREATE INDEX orders_employee ON orders(employee_id, starts_at);
CREATE TABLE reservations (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
 employee_id TEXT REFERENCES employees(id), vehicle_id TEXT REFERENCES vehicles(id), trailer_id TEXT REFERENCES trailers(id),
 starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL,
 CHECK(ends_at > starts_at), CHECK((employee_id IS NOT NULL)+(vehicle_id IS NOT NULL)+(trailer_id IS NOT NULL) = 1),
 UNIQUE(order_id,employee_id), UNIQUE(order_id,vehicle_id), UNIQUE(order_id,trailer_id)
);
CREATE INDEX reservation_driver ON reservations(employee_id,starts_at,ends_at);
CREATE INDEX reservation_vehicle ON reservations(vehicle_id,starts_at,ends_at);
CREATE INDEX reservation_trailer ON reservations(trailer_id,starts_at,ends_at);
CREATE TRIGGER reservation_consistency BEFORE INSERT ON reservations BEGIN
 SELECT RAISE(ABORT,'reservation_mismatch') WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.id=NEW.order_id AND o.status IN ('planned','in_progress')
  AND o.starts_at=NEW.starts_at AND o.ends_at=NEW.ends_at
  AND (o.employee_id=NEW.employee_id OR o.vehicle_id=NEW.vehicle_id OR o.trailer_id=NEW.trailer_id)
 );
END;
CREATE TRIGGER reservation_overlap BEFORE INSERT ON reservations BEGIN
 SELECT RAISE(ABORT,'reservation_conflict') WHERE EXISTS (
  SELECT 1 FROM reservations r WHERE r.starts_at < NEW.ends_at AND NEW.starts_at < r.ends_at
  AND (r.employee_id=NEW.employee_id OR r.vehicle_id=NEW.vehicle_id OR r.trailer_id=NEW.trailer_id)
 );
END;
CREATE TRIGGER reservation_immutable BEFORE UPDATE ON reservations BEGIN
 SELECT RAISE(ABORT,'reservation_immutable');
END;
CREATE TABLE absences (
 id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id), kind TEXT NOT NULL CHECK(kind IN ('vacation','sick','off_duty')),
 starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), CHECK(ends_at > starts_at)
);
CREATE INDEX absence_interval ON absences(employee_id,starts_at,ends_at);
CREATE TABLE downtimes (
 id TEXT PRIMARY KEY, vehicle_id TEXT REFERENCES vehicles(id), trailer_id TEXT REFERENCES trailers(id), harvester_id TEXT REFERENCES harvesters(id),
 kind TEXT NOT NULL CHECK(kind IN ('service','out_of_service')), starts_at INTEGER NOT NULL, ends_at INTEGER, reason TEXT NOT NULL,
 CHECK(ends_at IS NULL OR ends_at > starts_at), CHECK((vehicle_id IS NOT NULL)+(trailer_id IS NOT NULL)+(harvester_id IS NOT NULL) = 1)
);
CREATE TABLE order_status_events (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), old_status TEXT, new_status TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL);
CREATE TABLE fuel_prices (month TEXT PRIMARY KEY, price_cents INTEGER NOT NULL CHECK(price_cents > 0), source TEXT NOT NULL);
CREATE TABLE fuel_records (
 id TEXT PRIMARY KEY, vehicle_id TEXT REFERENCES vehicles(id), harvester_id TEXT REFERENCES harvesters(id), event_at INTEGER NOT NULL,
 actor_id TEXT NOT NULL REFERENCES users(id), employee_id TEXT NOT NULL REFERENCES employees(id), liters_milli INTEGER NOT NULL CHECK(liters_milli > 0),
 odometer_km INTEGER CHECK(odometer_km >= 0), meter_milli INTEGER CHECK(meter_milli >= 0), full_tank INTEGER NOT NULL DEFAULT 0,
 price_snapshot_cents INTEGER CHECK(price_snapshot_cents > 0), cost_cents INTEGER CHECK(cost_cents >= 0), harvest_id TEXT REFERENCES harvests(id), invalidated_at INTEGER,
 CHECK((vehicle_id IS NOT NULL)+(harvester_id IS NOT NULL) = 1)
);
CREATE TABLE meter_readings (id TEXT PRIMARY KEY, vehicle_id TEXT REFERENCES vehicles(id), harvester_id TEXT REFERENCES harvesters(id), event_at INTEGER NOT NULL, value_milli INTEGER NOT NULL CHECK(value_milli >= 0), source TEXT NOT NULL, correction_reason TEXT, CHECK((vehicle_id IS NOT NULL)+(harvester_id IS NOT NULL) = 1));
CREATE TABLE service_records (id TEXT PRIMARY KEY, vehicle_id TEXT REFERENCES vehicles(id), trailer_id TEXT REFERENCES trailers(id), harvester_id TEXT REFERENCES harvesters(id), event_at INTEGER NOT NULL, kind TEXT NOT NULL, description TEXT NOT NULL, cost_cents INTEGER CHECK(cost_cents >= 0), meter_milli INTEGER CHECK(meter_milli >= 0), provider TEXT, actor_id TEXT NOT NULL REFERENCES users(id), CHECK((vehicle_id IS NOT NULL)+(trailer_id IS NOT NULL)+(harvester_id IS NOT NULL) = 1));
CREATE TABLE service_schedules (id TEXT PRIMARY KEY, vehicle_id TEXT REFERENCES vehicles(id), trailer_id TEXT REFERENCES trailers(id), harvester_id TEXT REFERENCES harvesters(id), kind TEXT NOT NULL, last_service_id TEXT REFERENCES service_records(id), interval_milli INTEGER CHECK(interval_milli > 0), next_meter_milli INTEGER CHECK(next_meter_milli >= 0), next_date INTEGER, warning_milli INTEGER CHECK(warning_milli >= 0), CHECK((vehicle_id IS NOT NULL)+(trailer_id IS NOT NULL)+(harvester_id IS NOT NULL) = 1));
CREATE TABLE harvest_daily_records (id TEXT PRIMARY KEY, harvest_id TEXT NOT NULL REFERENCES harvests(id), date TEXT NOT NULL, harvester_id TEXT NOT NULL REFERENCES harvesters(id), volume_milli INTEGER NOT NULL CHECK(volume_milli >= 0), meter_start_milli INTEGER NOT NULL CHECK(meter_start_milli >= 0), meter_end_milli INTEGER NOT NULL, CHECK(meter_end_milli >= meter_start_milli), UNIQUE(harvest_id,date,harvester_id));
CREATE TABLE notifications (id TEXT PRIMARY KEY, recipient_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, entity_id TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL, read_at INTEGER, dedup_key TEXT NOT NULL UNIQUE);
CREATE TABLE outbox_events (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload_json TEXT NOT NULL, created_at INTEGER NOT NULL, processed_at INTEGER, dedup_key TEXT NOT NULL UNIQUE);
CREATE TABLE audit_events (
 id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), actor_name TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL,
 entity_id TEXT NOT NULL, before_json TEXT, after_json TEXT, created_at INTEGER NOT NULL, correlation_id TEXT NOT NULL
);
CREATE INDEX audit_time ON audit_events(created_at);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'audit_immutable'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'audit_immutable'); END;
CREATE TABLE recommendation_runs (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), input_json TEXT NOT NULL, rules_version TEXT NOT NULL, result_json TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
