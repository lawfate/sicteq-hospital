-- Tanda 3: usuarios con cambio de clave obligatorio, piezas por tipo de caja,
-- estantes etiquetados en bodega e incidencias por piezas faltantes.
-- Idempotente y solo aditiva.

-- Cuenta creada o reseteada por IT: debe cambiar la clave al entrar.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS debe_cambiar_clave BOOLEAN NOT NULL DEFAULT false;

-- Piezas que trae cada tipo de caja (se cuentan en Recepción).
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS piezas INTEGER;

-- Estantes de la bodega estéril, con etiqueta de código de barras (EST-B2).
CREATE TABLE IF NOT EXISTS estante (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    descripcion VARCHAR(100),
    activo BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE caja_fisica ADD COLUMN IF NOT EXISTS estante_id INTEGER REFERENCES estante(id);

-- Piezas contadas al recibir la caja (queda en el movimiento de Recepción).
ALTER TABLE historial_movimiento ADD COLUMN IF NOT EXISTS piezas_contadas INTEGER;

-- Incidencia: la caja volvió con piezas de menos. Queda abierta hasta que Enfermería o IT la resuelve.
CREATE TABLE IF NOT EXISTS incidencia (
    id SERIAL PRIMARY KEY,
    caja_fisica_id INTEGER NOT NULL REFERENCES caja_fisica(id),
    piezas_esperadas INTEGER NOT NULL,
    piezas_contadas INTEGER NOT NULL,
    detalle VARCHAR(255),
    usuario_id INTEGER REFERENCES usuario(id),
    fecha TIMESTAMP NOT NULL DEFAULT NOW(),
    resuelta_por INTEGER REFERENCES usuario(id),
    fecha_resolucion TIMESTAMP,
    resolucion VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS incidencia_abiertas ON incidencia (fecha) WHERE fecha_resolucion IS NULL;
