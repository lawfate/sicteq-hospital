-- ==========================================
-- SICTEQ - HOSPITAL REGIONAL DE RANCAGUA
-- Esquema de Base de Datos Real (PostgreSQL)
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
CREATE TABLE solicitud (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuario(id),
    area_id INTEGER REFERENCES area(id),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(50)
);

-- 5. DETALLE SOLICITUD (Depende de Solicitud e Inventario)
CREATE TABLE detalle_solicitud (
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER REFERENCES solicitud(id),
    inventario_id INTEGER REFERENCES inventario(id),
    cantidad_solicitada INTEGER
);

-- 6. HISTORIAL DE MOVIMIENTO (Depende de Inventario, Usuario, Solicitud y Area)
CREATE TABLE historial_movimiento (
    id SERIAL PRIMARY KEY,
    inventario_id INTEGER REFERENCES inventario(id),
    usuario_id INTEGER REFERENCES usuario(id),
    estado_anterior VARCHAR(50),
    estado_nuevo VARCHAR(50),
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    justificacion VARCHAR(255),
    solicitud_id INTEGER REFERENCES solicitud(id),
    area_destino_id INTEGER REFERENCES area(id)
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