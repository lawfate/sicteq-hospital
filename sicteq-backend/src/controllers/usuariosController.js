const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { registrarAuditoria } = require('../utils/auditoria');
const { normalizarRut, generarClaveTemporal } = require('../utils/usuarios');
const { entero } = require('../utils/validacion');

const getRoles = async (req, res) => {
    try {
        res.json((await db.query('SELECT id, nombre FROM rol ORDER BY nombre')).rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al cargar roles' });
    }
};

const getUsuarios = async (req, res) => {
    try {
        const result = await db.query(`SELECT u.id, u.rut, u.nombre, r.nombre AS rol, u.activo,
            u.debe_cambiar_clave, COALESCE(u.bloqueado_hasta > NOW(), false) AS bloqueado
            FROM usuario u JOIN rol r ON r.id = u.rol_id ORDER BY u.nombre, u.id`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al cargar usuarios' });
    }
};

const crearUsuario = async (req, res) => {
    const rut = normalizarRut(req.body?.rut);
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    const rol_id = entero(req.body?.rol_id);
    if (!rut) return res.status(400).json({ error: 'RUT inválido: revise el formato y el dígito verificador.' });
    if (nombre.length < 3 || nombre.length > 100) return res.status(400).json({ error: 'El nombre debe tener entre 3 y 100 caracteres.' });
    if (rol_id === null) return res.status(400).json({ error: 'rol_id debe ser un entero positivo.' });
    let client;
    try {
        const clave_temporal = generarClaveTemporal();
        const hash = await bcrypt.hash(clave_temporal, 10);
        client = await db.connect();
        await client.query('BEGIN');
        // El esquema antiguo no declara UNIQUE para rut.
        await client.query('LOCK TABLE usuario IN SHARE ROW EXCLUSIVE MODE');
        const rol = await client.query('SELECT id FROM rol WHERE id = $1', [rol_id]);
        if (!rol.rowCount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'El rol indicado no existe.' });
        }
        const duplicado = await client.query('SELECT id FROM usuario WHERE rut = $1 LIMIT 1', [rut]);
        if (duplicado.rowCount) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Ya existe un usuario con ese RUT.' });
        }
        const result = await client.query(`INSERT INTO usuario (rut, nombre, rol_id, password_hash, activo, debe_cambiar_clave)
            VALUES ($1, $2, $3, $4, true, true) RETURNING id, rut, nombre`, [rut, nombre, rol_id, hash]);
        await client.query('COMMIT');
        const usuario = result.rows[0];
        await registrarAuditoria(req, 'crear_usuario', 'usuario', usuario.id, { rut, nombre, rol_id });
        res.status(201).json({ ...usuario, clave_temporal });
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un usuario con ese RUT.' });
        if (err.code === '23503') return res.status(400).json({ error: 'El rol indicado no existe.' });
        res.status(500).json({ error: 'Error al crear usuario' });
    } finally {
        if (client) client.release();
    }
};

const actualizarActivo = async (req, res) => {
    const id = entero(req.params.id);
    const activo = req.body?.activo;
    if (id === null || typeof activo !== 'boolean') return res.status(400).json({ error: 'Se requiere un id válido y activo booleano.' });
    if (!activo && id === Number(req.user.id)) return res.status(409).json({ error: 'No puedes desactivar tu propia cuenta.' });
    try {
        const result = await db.query(`UPDATE usuario SET activo = $2,
            sesion_id = CASE WHEN $2 THEN sesion_id ELSE NULL END WHERE id = $1 RETURNING id, activo`, [id, activo]);
        if (!result.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
        await registrarAuditoria(req, 'actualizar_usuario_activo', 'usuario', id, { activo });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
};

const resetearClave = async (req, res) => {
    const id = entero(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Id de usuario inválido.' });
    try {
        const clave_temporal = generarClaveTemporal();
        const hash = await bcrypt.hash(clave_temporal, 10);
        const result = await db.query(`UPDATE usuario SET password_hash = $2, debe_cambiar_clave = true,
            intentos_fallidos = 0, bloqueado_hasta = NULL, sesion_id = NULL WHERE id = $1 RETURNING id`, [id, hash]);
        if (!result.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
        await registrarAuditoria(req, 'resetear_clave', 'usuario', id, null);
        res.json({ clave_temporal });
    } catch (err) {
        res.status(500).json({ error: 'Error al resetear clave' });
    }
};

module.exports = { getRoles, getUsuarios, crearUsuario, actualizarActivo, resetearClave, normalizarRut, generarClaveTemporal };
