export type Role = 'dispatcher' | 'driver';
export interface User {
  id: string;
  username: string;
  role: Role;
  active: number;
  employee_id: string | null;
  display_name: string;
  must_change_password: number;
  version: number;
}
export interface Employee {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  active: number;
}
export interface Vehicle {
  id: string;
  plate: string;
  manufacturer: string;
  model: string;
  capacity_kg: number | null;
  crane: number;
  active: number;
}
export interface Trailer {
  id: string;
  plate: string;
  manufacturer: string;
  model: string;
  active: number;
}
export interface Order {
  id: string;
  number: string;
  pickup: string;
  delivery: string;
  starts_at: number;
  ends_at: number;
  status: string;
  employee_id: string;
  vehicle_id: string;
  trailer_id: string | null;
  material: string;
  weight_kg: number | null;
  volume_milli: number | null;
  note: string;
  driver_name: string;
  plate: string;
  trailer_plate: string | null;
  version: number;
  price_cents?: number | null;
}
export interface Audit {
  id: string;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json: string | null;
  after_json: string | null;
  created_at: number;
  correlation_id: string;
}
export interface Bootstrap {
  user: User;
  csrfToken: string;
  demo: boolean;
  employees: Employee[];
  fetchedAt: number;
}
