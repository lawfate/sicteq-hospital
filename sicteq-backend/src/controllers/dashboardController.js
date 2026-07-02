const db = require('../config/db');

const getDashboardData = async (req, res) => {
    try {
        // Consultas para las métricas
        const stats = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM CICLO_ESTERILIZACION WHERE estado = 'En Proceso') as en_proceso,
                (SELECT COUNT(*) FROM INVENTARIO WHERE estado_actual = 'Alerta') as alertas_stock,
                (SELECT COUNT(*) FROM SOLICITUD WHERE estado = 'Pendiente') as solicitudes_pendientes,
                (SELECT COUNT(*) FROM INVENTARIO) as total_equipos
        `);

        // Consultas para el historial
        const movimientos = await db.query(`
            SELECT h.*, a.nombre AS destino
            FROM HISTORIAL_MOVIMIENTO h
            LEFT JOIN AREA a ON h.area_destino_id = a.id
            ORDER BY h.fecha_cambio DESC LIMIT 5
        `);

        // NUEVO: Consulta para Solicitudes Críticas (Cruza 4 tablas)
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
            ORDER BY s.fecha_creacion DESC LIMIT 5
        `);

        // Respuesta consolidada
        res.json({
            stats: stats.rows[0],
            movimientos: movimientos.rows,
            criticas: criticas.rows // <--- ¡AQUÍ SE ENVÍAN LOS DATOS!
        });
    } catch (err) {
        console.error("Error en dashboard:", err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getDashboardData };