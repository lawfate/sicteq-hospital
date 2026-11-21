const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt');
const { registrarAuditoria } = require('../utils/auditoria');

// PB-11: tras 5 intentos fallidos la cuenta queda bloqueada 15 minutos.
const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;

const login = async (req, res) => {
    const { rut, password } = req.body;

    if (!rut || !password) {
        return res.status(400).json({ error: "Se requiere rut y password" });
    }

    try {
        // Buscamos al usuario y traemos su rol mediante un JOIN. Ya no
        // comparamos la contraseña en el WHERE -- password_hash ahora es un
        // hash bcrypt, no texto plano, así que hay que traer la fila y
        // comparar con bcrypt.compare.
        const result = await db.query(`
            SELECT u.id, u.rut, u.nombre, u.password_hash, u.rol_id, r.nombre as rol, u.debe_cambiar_clave,
                   CEIL(EXTRACT(EPOCH FROM (u.bloqueado_hasta - NOW())) / 60)::int AS minutos_bloqueo
            FROM usuario u
            JOIN rol r ON u.rol_id = r.id
            WHERE u.rut = $1 AND u.activo = true
        `, [rut]);

        if (result.rows.length === 0) {
            await registrarAuditoria(req, 'login_fallido', 'usuario', rut, { motivo: 'rut_inexistente' });
            return res.status(401).json({ error: "RUT o contraseña incorrectos" });
        }

        const row = result.rows[0];
        if (row.minutos_bloqueo > 0) {
            await registrarAuditoria(req, 'login_fallido', 'usuario', row.id, { motivo: 'cuenta_bloqueada' }, row.id);
            return res.status(429).json({ error: `Cuenta bloqueada por intentos fallidos. Intenta de nuevo en ${row.minutos_bloqueo} minuto(s).` });
        }

        const passwordOk = await bcrypt.compare(password, row.password_hash);

        if (!passwordOk) {
            const upd = await db.query(`
                UPDATE usuario
                SET intentos_fallidos = intentos_fallidos + 1,
                    bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= $2 THEN NOW() + make_interval(mins => $3) ELSE NULL END
                WHERE id = $1 RETURNING intentos_fallidos`, [row.id, MAX_INTENTOS, MINUTOS_BLOQUEO]);
            const intentos = upd.rows[0].intentos_fallidos;
            await registrarAuditoria(req, 'login_fallido', 'usuario', row.id, { motivo: 'password_incorrecta', intentos }, row.id);
            if (intentos >= MAX_INTENTOS) {
                await registrarAuditoria(req, 'cuenta_bloqueada', 'usuario', row.id, { minutos: MINUTOS_BLOQUEO }, row.id);
                return res.status(429).json({ error: `Demasiados intentos fallidos. La cuenta quedó bloqueada ${MINUTOS_BLOQUEO} minutos.` });
            }
            return res.status(401).json({ error: `RUT o contraseña incorrectos (intento ${intentos} de ${MAX_INTENTOS}).` });
        }

        const user = { id: row.id, rut: row.rut, nombre: row.nombre, rol: row.rol, debe_cambiar_clave: row.debe_cambiar_clave };
        // PB-02: cada login abre una sesión nueva (sid) y deja inválida la
        // anterior del mismo usuario -- sin sesiones simultáneas.
        const sid = crypto.randomUUID();
        await db.query('UPDATE usuario SET sesion_id = $1, ultima_actividad = NOW(), intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $2', [sid, row.id]);
        const token = jwt.sign({ id: row.id, rol_id: row.rol_id, rol: row.rol, sid }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        await registrarAuditoria(req, 'login', 'usuario', row.id, null, row.id);

        res.json({ message: "Login exitoso", user, token });

    } catch (err) {
        console.error("Error en login:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};



// Cierre de sesión explícito: invalida el sid en el servidor, no solo en el navegador.
const logout = async (req, res) => {
    try {
        await db.query('UPDATE usuario SET sesion_id = NULL WHERE id = $1', [req.user.id]);
        await registrarAuditoria(req, 'logout', 'usuario', req.user.id);
        res.json({ message: 'Sesión cerrada' });
    } catch (err) {
        console.error('Error en logout:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Cambio de clave (obligatorio tras crear o resetear la cuenta). Mínimo 8
// caracteres, distinta de la actual; exige la clave actual (la temporal).
const CLAVE_MINIMA = 8;
const cambiarClave = async (req, res) => {
    const actual = String(req.body.actual || '');
    const nueva = String(req.body.nueva || '');
    if (nueva.length < CLAVE_MINIMA || nueva.length > 72) {
        return res.status(400).json({ error: `La clave nueva debe tener entre ${CLAVE_MINIMA} y 72 caracteres.` });
    }
    if (nueva === actual) {
        return res.status(400).json({ error: 'La clave nueva debe ser distinta de la actual.' });
    }
    try {
        const u = await db.query('SELECT password_hash FROM usuario WHERE id = $1 AND activo = true', [req.user.id]);
        if (!u.rows[0] || !(await bcrypt.compare(actual, u.rows[0].password_hash))) {
            await registrarAuditoria(req, 'cambio_clave_fallido', 'usuario', req.user.id);
            return res.status(400).json({ error: 'La clave actual no es correcta.' });
        }
        const hash = await bcrypt.hash(nueva, 10);
        await db.query('UPDATE usuario SET password_hash = $1, debe_cambiar_clave = false WHERE id = $2', [hash, req.user.id]);
        await registrarAuditoria(req, 'cambio_clave', 'usuario', req.user.id);
        res.json({ message: 'Clave actualizada.' });
    } catch (err) {
        console.error('Error al cambiar la clave:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

module.exports = { login, logout, cambiarClave };
