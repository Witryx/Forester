// Runtime SQL must address Forester tables explicitly. Session search_path is
// unreliable with Neon transaction pooling and must never select another app's tables.
const tables = new Set([
  'employees',
  'users',
  'sessions',
  'vehicles',
  'trailers',
  'default_assignments',
  'customers',
  'forester_contacts',
  'harvesters',
  'harvests',
  'orders',
  'reservations',
  'absences',
  'downtimes',
  'order_status_events',
  'fuel_prices',
  'fuel_records',
  'meter_readings',
  'service_records',
  'service_schedules',
  'harvest_daily_records',
  'notifications',
  'outbox_events',
  'audit_events',
  'recommendation_runs',
  'settings',
  'schema_migrations',
  'login_attempts',
]);

export function qualifyPostgresTables(sql: string) {
  // The application's SQL uses unquoted table names. Skip string literals, quoted
  // identifiers and comments; leave explicitly qualified references unchanged.
  return sql.replace(
    /'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\r\n]*|\/\*[\s\S]*?\*\/|\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_][a-z0-9_]*)(?![\w.])/gi,
    (text, table: string | undefined) =>
      table && tables.has(table.toLowerCase())
        ? text.slice(0, -table.length) + `forester.${table}`
        : text,
  );
}
