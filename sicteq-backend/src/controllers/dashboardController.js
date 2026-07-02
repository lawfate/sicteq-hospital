const db = require('../config/db');

const getDashboardData = async (req, res) => {
    try {
        const stats = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM CICLO_ESTERILIZACION WHERE estado = 'En Proceso') as en_proceso,
                (SELECT COUNT(*) FROM INVENTARIO WHERE estado_actual = 'Alerta') as alertas_stock,
                (SELECT COUNT(*) FROM SOLICITUD WHERE estado = 'Pendiente') as solicitudes_pendientes,
                (SELECT COUNT(*) FROM INVENTARIO) as total_equipos
        `);

        // Aquí ya estás trayendo 'a.nombre' como 'destino'
        const movimientos = await db.query(`
            SELECT h.*, a.nombre AS destino
            FROM HISTORIAL_MOVIMIENTO h
            LEFT JOIN AREA a ON h.area_destino_id = a.id
            ORDER BY h.fecha_cambio DESC LIMIT 5
        `);

        const criticas = await db.query(`
            SELECT 
                s.id AS solicitud_id,
                i.nombre_equipo AS caja_requerida,
                a.nombre AS pabellon,
                s.estado AS estado_actual
            FROM SOLICITUD s
            JOIN AREA a ON s.area_id = a.id
            JOIN DETALLE_SOLICITUD ds ON ds.solicitud_id = s.id
            JOIN INVENTARIO i ON ds.inventario_id = i.id
            WHERE s.estado IN ('Pendiente', 'En Preparación', 'Listo')
            ORDER BY s.fecha_creacion DESC LIMIT 5
        `);

        res.json({
            stats: stats.rows[0],
            movimientos: movimientos.rows,
            criticas: criticas.rows 
        });
    } catch (err) {
        console.error("Error en dashboard:", err);
        res.status(500).json({ error: err.message });
    }
};

const getHistorialCaja = async (req, res) => {
    const { id } = req.params;
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
        console.error("Error en historial de caja:", err);
        res.status(500).json({ error: "Error al obtener historial" });
    }
};

module.exports = { getDashboardData, getHistorialCaja }; // Asegúrate de exportar ambos