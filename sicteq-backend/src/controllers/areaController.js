const db = require('../config/db');

const obtenerAreas = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM AREA');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener áreas' });
    }
};

module.exports = { obtenerAreas };