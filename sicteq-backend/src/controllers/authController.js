const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt');
const { registrarAuditoria } = require('../utils/auditoria');

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
            SELECT u.id, u.rut, u.nombre, u.password_hash, u.rol_id, r.nombre as rol
            FROM usuario u
            JOIN rol r ON u.rol_id = r.id
            WHERE u.rut = $1 AND u.activo = true
        `, [rut]);

        if (result.rows.length === 0) {
            await registrarAuditoria(req, 'login_fallido', 'usuario', rut, { motivo: 'rut_inexistente' });
            return res.status(401).json({ error: "RUT o contraseña incorrectos" });
        }

        const row = result.rows[0];
        const passwordOk = await bcrypt.compare(password, row.password_hash);

        if (!passwordOk) {
            await registrarAuditoria(req, 'login_fallido', 'usuario', row.id, { motivo: 'password_incorrecta' }, row.id);
            return res.status(401).json({ error: "RUT o contraseña incorrectos" });
        }

        const user = { id: row.id, rut: row.rut, nombre: row.nombre, rol: row.rol };
        // PB-02: cada login abre una sesión nueva (sid) y deja inválida la
        // anterior del mismo usuario -- sin sesiones simultáneas.
        const sid = crypto.randomUUID();
        await db.query('UPDATE usuario SET sesion_id = $1, ultima_actividad = NOW() WHERE id = $2', [sid, row.id]);
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

module.exports = { login, logout };
