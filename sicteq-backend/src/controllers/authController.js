const db = require('../config/db');

const login = async (req, res) => {
    const { rut, password } = req.body;

    try {
        // Buscamos al usuario y traemos su rol mediante un JOIN
        const result = await db.query(`
            SELECT u.id, u.rut, u.nombre, r.nombre as rol
            FROM usuario u
            JOIN rol r ON u.rol_id = r.id
            WHERE u.rut = $1 AND u.password_hash = $2 AND u.activo = true
        `, [rut, password]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: "RUT o contraseña incorrectos" });
        }

        // Si existe, devolvemos los datos del usuario (sin la contraseña)
        const user = result.rows[0];
        res.json({ message: "Login exitoso", user });

    } catch (err) {
        console.error("Error en login:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

module.exports = { login };