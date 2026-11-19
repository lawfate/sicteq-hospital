-- Rendimiento: casi todas las consultas buscan el último movimiento de una
-- caja (dashboard, ciclo, despacho, indicadores). Idempotente.
CREATE INDEX IF NOT EXISTS idx_historial_caja_fecha ON historial_movimiento (caja_fisica_id, fecha_cambio DESC);
CREATE INDEX IF NOT EXISTS idx_historial_estado_fecha ON historial_movimiento (estado_nuevo, fecha_cambio);
