const db = require('../config/db');

const getHistorialCaja = async (req, res) => {
    const { id } = req.params; // ID del inventario
    try {
        const result = await db.query(`
            SELECT h.*, a.nombre AS destino_nombre
            FROM HISTORIAL_MOVIMIENTO h
            LEFT JOIN AREA a ON h.area_destino_id = a.id
            WHERE h.inventario_id = $1
            ORDER BY h.fecha_cambio DESC
        `, [id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener historial" });
    }
};

module.exports = { getHistorialCaja };