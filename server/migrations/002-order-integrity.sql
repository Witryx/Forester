-- Přeplánování či ukončení musí nejprve atomicky nahradit/uvolnit rezervace.
CREATE TRIGGER orders_reserved_fields BEFORE UPDATE OF starts_at,ends_at,employee_id,vehicle_id,trailer_id,status ON orders
WHEN EXISTS (SELECT 1 FROM reservations WHERE order_id=OLD.id)
 AND (NEW.starts_at != OLD.starts_at OR NEW.ends_at != OLD.ends_at
  OR NEW.employee_id IS NOT OLD.employee_id OR NEW.vehicle_id IS NOT OLD.vehicle_id
  OR NEW.trailer_id IS NOT OLD.trailer_id OR NEW.status NOT IN ('planned','in_progress'))
BEGIN SELECT RAISE(ABORT,'order_has_reservations'); END;
