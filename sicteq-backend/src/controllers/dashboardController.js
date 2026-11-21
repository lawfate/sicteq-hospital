const db = require('../config/db');

const getDashboardData = async (req, res) => {
    try {
        // Las tres consultas son independientes: en paralelo (PB-08, prueba de carga).
        const [stats, movimientos, criticas] = await Promise.all([db.query(`
            SELECT
                -- Cajas físicas en circulación cuya última etapa registrada
                -- está dentro del ciclo de reproceso (1 a 4: aún no listas;
                -- Almacenamiento cuenta como lista). Antes esto consultaba CICLO_ESTERILIZACION,
                -- una tabla en la que nada del código actual inserta filas.
                (SELECT COUNT(*) FROM (
                    SELECT DISTINCT ON (cf.id) cf.id, h.estado_nuevo
                    FROM caja_fisica cf
                    JOIN historial_movimiento h ON h.caja_fisica_id = cf.id
                    WHERE cf.estado = 'En circulación'
                    ORDER BY cf.id, h.fecha_cambio DESC
                ) ultimo WHERE ultimo.estado_nuevo ~ '^Etapa [1-4]$') as en_proceso,
                -- Mismo criterio que /api/alertas: stock bajo el crítico o en
                -- un estado que requiere atención, no solo 'Alerta'.
                (SELECT COUNT(*) FROM INVENTARIO WHERE cantidad_disponible <= stock_critico OR estado_actual IN ('Alerta', 'Merma', 'En Reparación')) as alertas_stock,
                (SELECT COUNT(*) FROM SOLICITUD WHERE estado IN ('Pendiente', 'En Preparación', 'Listo')) as solicitudes_pendientes,
                -- Estado actual (no histórico): cajas en bodega (Etapa 5) o
                -- despachadas a pabellón que aún no vuelven. Antes sumaba todas
                -- las solicitudes despachadas de la historia.
                (SELECT COUNT(*) FROM (
                    SELECT DISTINCT ON (cf.id) cf.id, h.estado_nuevo
                    FROM caja_fisica cf
                    JOIN historial_movimiento h ON h.caja_fisica_id = cf.id
                    WHERE cf.estado = 'En circulación'
                    ORDER BY cf.id, h.fecha_cambio DESC
                ) ultimo WHERE ultimo.estado_nuevo IN ('Etapa 5', 'Etapa 6', 'Despachado')) as total_equipos
        `),

        // Historial de trazabilidad (se mantiene igual)
        db.query(`
            SELECT h.*, a.nombre AS destino
            FROM HISTORIAL_MOVIMIENTO h
            LEFT JOIN AREA a ON h.area_destino_id = a.id
            ORDER BY h.fecha_cambio DESC LIMIT 5
        `),

        // ACTUALIZADO: Adaptado para leer 'tipo_cirugia' y sacar la caja de 'observaciones'
        // ya que aún no tenemos la tabla intermedia conectada.
        db.query(`
            SELECT 
                s.id AS solicitud_id,
                s.tipo_cirugia,
                s.observaciones AS caja_requerida,
                a.nombre AS pabellon,
                s.estado AS estado_actual
            FROM SOLICITUD s
            JOIN AREA a ON s.area_id = a.id
            WHERE s.estado IN ('Pendiente', 'En Preparación', 'Listo')
            ORDER BY s.id DESC LIMIT 5
        `)]);

        res.json({
            stats: stats.rows[0],
            movimientos: movimientos.rows,
            criticas: criticas.rows 
        });
    } catch (err) {
        console.error("Error en dashboard:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

const getHistorialCaja = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) {
        return res.status(400).json({ error: "Id de inventario inválido" });
    }
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

module.exports = { getDashboardData, getHistorialCaja };