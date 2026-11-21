const db = require('../config/db');

const getInventario = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, nombre_equipo, codigo_barra, cantidad_disponible, cantidad_total, estado_actual, stock_critico
            FROM INVENTARIO
            ORDER BY nombre_equipo ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Error al cargar inventario" });
    }
};

module.exports = { getInventario };