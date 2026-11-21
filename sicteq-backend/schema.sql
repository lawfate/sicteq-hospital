-- ==========================================
-- SICTEQ - HOSPITAL REGIONAL DE RANCAGUA
-- Esquema real de la base de datos (PostgreSQL / Neon)
-- Generado por introspección directa de information_schema
-- el 2026-08-23. Esta es la ÚNICA fuente de verdad del esquema:
-- reemplaza a databse/init.sql y a BD HOSPITAL.sql (ambos
-- desactualizados respecto a lo que corre en producción).
--
-- 2026-08-24: se agregó caja_fisica + historial_movimiento.caja_fisica_id.
-- INVENTARIO representa el TIPO de caja (categoría, ej. "Cirugía Menor",
-- con su codigo_barra tipo GEN-001). CAJA_FISICA representa cada unidad
-- física individual que circula (codigo_caja tipo CAJA-0045) -- son
-- conceptos distintos: un mismo tipo puede tener varias cajas físicas
-- en circulación al mismo tiempo, cada una en una etapa distinta.
--
-- 2026-08-24 (2): se agregan metodo_esterilizacion/temperatura/presion/
-- tiempo_minutos a historial_movimiento -- se completan solo al pasar por
-- la etapa de Esterilización, para cumplir el requerimiento formal de
-- registrar los parámetros del ciclo, no solo el nombre de la etapa.
--
-- 2026-08-24 (3): se agregan PACIENTE y VINCULO_CAJA_PACIENTE. Antes el
-- "Vínculo Clínico" era 100% mock (3 pacientes hardcodeados en el
-- frontend, sin persistencia). VINCULO_CAJA_PACIENTE es la tabla que da
-- la trazabilidad BIDIRECCIONAL real que pide el requerimiento: desde
-- una caja física se puede ver a qué paciente(s) se usó, y desde un
-- paciente se puede ver qué cajas se le vincularon.
--
-- 2026-08-24 (4): se agrega caja_fisica.fecha_caducidad -- se calcula al
-- pasar una caja por la etapa de Almacenamiento (hoy + vigencia en días),
-- para poder alertar sobre rotación de stock por vencimiento de empaque,
-- algo que antes no se registraba en ningún lado.
--
-- 2026-08-24 (5): usuario.password_hash pasa a contener hashes bcrypt reales
-- (antes tenía la contraseña en texto plano, comparada tal cual en el
-- login). Migración one-off sobre los 3 usuarios existentes: mismo valor de
-- contraseña, solo cambia cómo se guarda. El login ahora también emite un
-- JWT (ver src/config/jwt.js y src/middleware/authMiddleware.js) que se
-- exige en todos los endpoints salvo /api/auth y /api/health.
-- ==========================================

-- 1. TABLAS MAESTRAS (Sin dependencias)
CREATE TABLE rol (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50),
    descripcion VARCHAR(255)
);

CREATE TABLE area (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100)
);

CREATE TABLE categoria (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100)
);

-- 2. USUARIOS (Depende de Rol)
CREATE TABLE usuario (
    id SERIAL PRIMARY KEY,
    rol_id INTEGER REFERENCES rol(id),
    rut VARCHAR(12),
    nombre VARCHAR(100),
    password_hash VARCHAR(255),
    activo BOOLEAN DEFAULT true
);

-- 3. INVENTARIO (Depende de Categoria)
CREATE TABLE inventario (
    id SERIAL PRIMARY KEY,
    categoria_id INTEGER REFERENCES categoria(id),
    codigo_barra VARCHAR(50),
    nombre_equipo VARCHAR(100),
    cantidad_total INTEGER,
    cantidad_disponible INTEGER,
    estado_actual VARCHAR(50),
    stock_critico INTEGER DEFAULT 1
);

-- 4. SOLICITUDES (Depende de Usuario y Area)
-- NOTA: tipo_cirugia y observaciones fueron agregadas directo en Neon
-- (ALTER TABLE manual) y no estaban documentadas en ningún .sql del repo
-- hasta esta reconciliación.
CREATE TABLE solicitud (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuario(id),
    area_id INTEGER REFERENCES area(id),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(50),
    tipo_cirugia VARCHAR(100),
    observaciones TEXT
);

-- 5. DETALLE SOLICITUD (Depende de Solicitud e Inventario)
CREATE TABLE detalle_solicitud (
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER REFERENCES solicitud(id),
    inventario_id INTEGER REFERENCES inventario(id),
    cantidad_solicitada INTEGER
);

-- 5b. CAJA FÍSICA (Depende de Inventario) -- unidad física individual,
-- distinta del tipo/categoría que representa INVENTARIO
CREATE TABLE caja_fisica (
    id SERIAL PRIMARY KEY,
    inventario_id INTEGER REFERENCES inventario(id),
    codigo_caja VARCHAR(50) UNIQUE NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'En circulación',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_eliminacion TIMESTAMP,
    fecha_caducidad TIMESTAMP
);

-- 6. HISTORIAL DE MOVIMIENTO (Depende de Inventario, Usuario, Solicitud, Area y Caja Física)
CREATE TABLE historial_movimiento (
    id SERIAL PRIMARY KEY,
    inventario_id INTEGER REFERENCES inventario(id),
    usuario_id INTEGER REFERENCES usuario(id),
    estado_anterior VARCHAR(50),
    estado_nuevo VARCHAR(50),
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    justificacion VARCHAR(255),
    solicitud_id INTEGER REFERENCES solicitud(id),
    area_destino_id INTEGER REFERENCES area(id),
    caja_fisica_id INTEGER REFERENCES caja_fisica(id),
    metodo_esterilizacion VARCHAR(50),
    temperatura NUMERIC(5,1),
    presion VARCHAR(20),
    tiempo_minutos INTEGER
);

-- 7. CICLO DE ESTERILIZACIÓN (Depende de Usuario)
CREATE TABLE ciclo_esterilizacion (
    id SERIAL PRIMARY KEY,
    operador_id INTEGER REFERENCES usuario(id),
    maquina_autoclave VARCHAR(100),
    fecha_inicio TIMESTAMP,
    fecha_fin TIMESTAMP,
    estado VARCHAR(50)
);

-- 8. VÍNCULO TRAZABILIDAD (Depende de Ciclo e Inventario)
CREATE TABLE vinculo_trazabilidad (
    id SERIAL PRIMARY KEY,
    ciclo_id INTEGER REFERENCES ciclo_esterilizacion(id),
    inventario_id INTEGER REFERENCES inventario(id),
    cantidad_procesada INTEGER,
    resultado VARCHAR(50)
);

-- 9. PACIENTE (Depende de Area)
CREATE TABLE paciente (
    id SERIAL PRIMARY KEY,
    rut VARCHAR(12) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    edad INTEGER,
    area_id INTEGER REFERENCES area(id),
    diagnostico VARCHAR(255),
    alertas_iaas VARCHAR(255)
);

-- 10. VÍNCULO CAJA-PACIENTE (Depende de Caja Física, Paciente y Usuario)
-- Cada fila es un evento de asociación real: da la trazabilidad
-- bidireccional caja <-> paciente.
CREATE TABLE vinculo_caja_paciente (
    id SERIAL PRIMARY KEY,
    caja_fisica_id INTEGER REFERENCES caja_fisica(id),
    paciente_id INTEGER REFERENCES paciente(id),
    usuario_id INTEGER REFERENCES usuario(id),
    fecha_vinculo TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
