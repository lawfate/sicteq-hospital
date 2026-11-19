-- PB-11: bloqueo temporal tras 5 intentos fallidos de inicio de sesión.
-- Idempotente y solo aditiva.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMP;
