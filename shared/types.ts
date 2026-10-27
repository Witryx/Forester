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

export type DriverStatus = 'available' | 'vacation' | 'sick' | 'off_duty' | 'inactive';
export type EquipmentStatus = 'available' | 'service' | 'out_of_service' | 'inactive';
export type Availability = DriverStatus | EquipmentStatus | 'assigned' | 'busy';
export interface Driver extends Employee {
  phone: string;
  email: string | null;
  status: DriverStatus;
  availability: Availability;
  note: string;
  version: number;
}
export interface FleetVehicle extends Vehicle {
  vin: string | null;
  year: number | null;
  kind: string;
  odometer_km: number | null;
  status: EquipmentStatus;
  availability: Availability;
  note: string;
  version: number;
  photo_count: number;
}
export interface FleetTrailer extends Trailer {
  year: number | null;
  kind: string;
  capacity_kg: number | null;
  status: EquipmentStatus;
  availability: Availability;
  note: string;
  version: number;
}
export interface Assignment {
  id: string;
  employee_id: string;
  vehicle_id: string;
  trailer_id: string | null;
  starts_at: number;
  ends_at: number | null;
}
export interface Fleet {
  drivers: Driver[];
  vehicles: FleetVehicle[];
  trailers: FleetTrailer[];
  assignments: Assignment[];
  fetchedAt: number;
}
