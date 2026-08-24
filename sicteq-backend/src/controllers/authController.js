const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt');

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
            return res.status(401).json({ error: "RUT o contraseña incorrectos" });
        }

        const row = result.rows[0];
        const passwordOk = await bcrypt.compare(password, row.password_hash);

        if (!passwordOk) {
            return res.status(401).json({ error: "RUT o contraseña incorrectos" });
        }

        const user = { id: row.id, rut: row.rut, nombre: row.nombre, rol: row.rol };
        const token = jwt.sign({ id: row.id, rol_id: row.rol_id, rol: row.rol }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        res.json({ message: "Login exitoso", user, token });

    } catch (err) {
        console.error("Error en login:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

module.exports = { login };