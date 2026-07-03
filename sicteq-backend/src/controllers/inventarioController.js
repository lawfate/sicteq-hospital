const db = require('../config/db');

const getInventario = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT nombre_equipo, piezas_disponibles, piezas_totales, estado_actual 
            FROM INVENTARIO 
            ORDER BY nombre_equipo ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Error al cargar inventario" });
    }
};

module.exports = { getInventario };