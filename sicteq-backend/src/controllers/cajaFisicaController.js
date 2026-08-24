const db = require('../config/db');

// Cajas físicas en circulación: cada fila es una unidad individual
// (codigo_caja, ej. CAJA-0045), no un tipo/categoría (eso es INVENTARIO).
const getCajasEnCirculacion = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                cf.id,
                cf.codigo_caja,
                cf.estado,
                cf.fecha_creacion,
                i.nombre_equipo,
                i.codigo_barra AS tipo_codigo,
                ultimo.estado_nuevo,
                ultimo.fecha_cambio AS ultima_actualizacion,
                ultimo.destino_nombre
            FROM caja_fisica cf
            JOIN inventario i ON cf.inventario_id = i.id
            LEFT JOIN LATERAL (
                SELECT h.estado_nuevo, h.fecha_cambio, a.nombre AS destino_nombre
                FROM historial_movimiento h
                LEFT JOIN area a ON h.area_destino_id = a.id
                WHERE h.caja_fisica_id = cf.id
                ORDER BY h.fecha_cambio DESC
                LIMIT 1
            ) ultimo ON true
            WHERE cf.estado = 'En circulación'
            ORDER BY cf.codigo_caja ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener cajas en circulación:", err);
        res.status(500).json({ error: "Error al obtener cajas en circulación" });
    }
};

module.exports = { getCajasEnCirculacion };
