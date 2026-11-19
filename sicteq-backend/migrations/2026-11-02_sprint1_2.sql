-- Sprint 1-2 (Informe 2, Tabla 47): PB-01 auditoría, PB-02 sesión única +
-- cierre por inactividad, PB-04 ciclo de autoclave + vínculo caja-ciclo.
-- Idempotente (IF NOT EXISTS): se puede correr más de una vez.
-- Solo agrega; no borra ni modifica datos existentes.

-- PB-02: sesión única y cierre a los 30 min sin uso. El token lleva sesion_id;
-- un login nuevo lo reemplaza y deja inválida la sesión anterior.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS sesion_id UUID;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS ultima_actividad TIMESTAMP;

-- PB-01: quién hizo qué y cuándo (incluye consultas a fichas de pacientes,
-- por la reserva que exige la Ley 20.584).
CREATE TABLE IF NOT EXISTS auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuario(id),
    accion VARCHAR(50) NOT NULL,
    entidad VARCHAR(50),
    entidad_id VARCHAR(50),
    detalle JSONB,
    ip VARCHAR(64),
    fecha TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria (usuario_id);

-- PB-04: identificador único de la carga = N° de autoclave + N° de ciclo
-- (lo que trae el voucher), más sus parámetros físicos.
ALTER TABLE ciclo_esterilizacion ADD COLUMN IF NOT EXISTS numero_maquina INTEGER;
ALTER TABLE ciclo_esterilizacion ADD COLUMN IF NOT EXISTS numero_ciclo INTEGER;
ALTER TABLE ciclo_esterilizacion ADD COLUMN IF NOT EXISTS metodo VARCHAR(50);
ALTER TABLE ciclo_esterilizacion ADD COLUMN IF NOT EXISTS temperatura NUMERIC(5,1);
ALTER TABLE ciclo_esterilizacion ADD COLUMN IF NOT EXISTS presion VARCHAR(20);
ALTER TABLE ciclo_esterilizacion ADD COLUMN IF NOT EXISTS tiempo_minutos INTEGER;
ALTER TABLE ciclo_esterilizacion ADD COLUMN IF NOT EXISTS observacion VARCHAR(255);
ALTER TABLE ciclo_esterilizacion ADD COLUMN IF NOT EXISTS liberado_por INTEGER REFERENCES usuario(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ciclo_maquina_numero
    ON ciclo_esterilizacion (numero_maquina, numero_ciclo);

-- Cada caja física de la carga. Un reproceso crea un vínculo nuevo; el
-- anterior nunca se sobrescribe (queda para auditoría y brotes de IAAS).
ALTER TABLE vinculo_trazabilidad ADD COLUMN IF NOT EXISTS caja_fisica_id INTEGER REFERENCES caja_fisica(id);
ALTER TABLE vinculo_trazabilidad ADD COLUMN IF NOT EXISTS fecha TIMESTAMP DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_vinculo_traz_caja ON vinculo_trazabilidad (caja_fisica_id, fecha DESC);
