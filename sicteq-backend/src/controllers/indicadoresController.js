const db = require('../config/db');

// KPI del Informe 2 (Tablas 32-33) calculables desde la base. K1 (búsquedas),
// K7 (disponibilidad) y K8 (tiempo de carga) se miden fuera de la base.
const ETAPAS = "('Etapa 1','Etapa 2','Etapa 3','Etapa 4','Etapa 5')";

const getIndicadores = async (req, res) => {
    const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 365);

    try {
        // K2: un ciclo = movimientos de una caja entre dos despachos. Completo si
        // tiene las etapas 1-5 con responsable antes de salir. Se excluye el
        // primer despacho de cada caja (su ciclo empezó antes de usar SICTEQ).
        const k2 = db.query(`
            WITH d AS (
                SELECT h.caja_fisica_id, h.fecha_cambio,
                       LAG(h.fecha_cambio) OVER (PARTITION BY h.caja_fisica_id ORDER BY h.fecha_cambio) AS anterior
                FROM historial_movimiento h WHERE h.estado_nuevo = 'Despachado'
            )
            SELECT COUNT(*)::int AS ciclos,
                   COUNT(*) FILTER (WHERE etapas = 5)::int AS completos
            FROM (
                SELECT (SELECT COUNT(DISTINCT m.estado_nuevo) FROM historial_movimiento m
                        WHERE m.caja_fisica_id = d.caja_fisica_id AND m.usuario_id IS NOT NULL
                          AND m.estado_nuevo IN ${ETAPAS}
                          AND m.fecha_cambio > d.anterior AND m.fecha_cambio < d.fecha_cambio) AS etapas
                FROM d
                WHERE d.anterior IS NOT NULL AND d.fecha_cambio >= NOW() - make_interval(days => $1)
            ) x`, [dias]);

        // K3: minutos entre la solicitud y su despacho, separado urgencia/programada.
        const k3 = db.query(`
            SELECT s.tipo_cirugia AS tipo, COUNT(*)::int AS n,
                   ROUND(AVG(EXTRACT(EPOCH FROM (h.fecha_cambio - s.fecha_creacion)) / 60))::int AS promedio_min,
                   ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (h.fecha_cambio - s.fecha_creacion)) / 60))::int AS p90_min
            FROM solicitud s
            JOIN historial_movimiento h ON h.solicitud_id = s.id AND h.estado_nuevo = 'Despachado'
            WHERE s.fecha_creacion >= NOW() - make_interval(days => $1)
            GROUP BY s.tipo_cirugia`, [dias]);

        // K6: despachos que quedaron vinculados a un paciente dentro de 24 h.
        const k6 = db.query(`
            SELECT COUNT(*)::int AS despachos,
                   COUNT(*) FILTER (WHERE EXISTS (
                       SELECT 1 FROM vinculo_caja_paciente v
                       WHERE v.caja_fisica_id = h.caja_fisica_id
                         AND v.fecha_vinculo BETWEEN h.fecha_cambio AND h.fecha_cambio + INTERVAL '24 hours'))::int AS vinculados
            FROM historial_movimiento h
            WHERE h.estado_nuevo = 'Despachado' AND h.fecha_cambio >= NOW() - make_interval(days => $1)`, [dias]);

        // K5 (aproximación): cajas almacenadas hoy con empaque vencido o por vencer.
        const k5 = db.query(`
            SELECT COUNT(*) FILTER (WHERE cf.fecha_caducidad < NOW())::int AS vencidas,
                   COUNT(*) FILTER (WHERE cf.fecha_caducidad >= NOW() AND cf.fecha_caducidad <= NOW() + INTERVAL '7 days')::int AS por_vencer,
                   COUNT(*)::int AS almacenadas
            FROM caja_fisica cf
            JOIN LATERAL (SELECT estado_nuevo FROM historial_movimiento h WHERE h.caja_fisica_id = cf.id
                          ORDER BY h.fecha_cambio DESC, h.id DESC LIMIT 1) u ON u.estado_nuevo = 'Etapa 5'
            WHERE cf.estado = 'En circulación'`);

        const cargas = db.query(`
            SELECT numero_maquina AS autoclave, COUNT(*)::int AS cargas,
                   COUNT(*) FILTER (WHERE estado = 'No estéril')::int AS no_esteriles,
                   COUNT(*) FILTER (WHERE estado = 'En proceso')::int AS en_proceso,
                   (SELECT COUNT(*) FROM vinculo_trazabilidad v WHERE v.ciclo_id = ANY(ARRAY_AGG(c.id)))::int AS cajas
            FROM ciclo_esterilizacion c
            WHERE numero_ciclo IS NOT NULL AND fecha_inicio >= NOW() - make_interval(days => $1)
            GROUP BY numero_maquina ORDER BY numero_maquina`, [dias]);

        const reprocesos = db.query(`
            SELECT COUNT(*) FILTER (WHERE estado_anterior = 'Etapa 4' AND estado_nuevo = 'Etapa 2')::int AS reprocesos,
                   COUNT(*) FILTER (WHERE justificacion ILIKE '%incidencia%')::int AS incidencias_recepcion
            FROM historial_movimiento WHERE fecha_cambio >= NOW() - make_interval(days => $1)`, [dias]);

        // Tiempo de reproceso: de Recepción a Almacenamiento, por cada paso por bodega.
        const tiempoCiclo = db.query(`
            SELECT ROUND(AVG(EXTRACT(EPOCH FROM (a.fecha_cambio - r.fecha)) / 3600)::numeric, 1) AS horas
            FROM historial_movimiento a
            JOIN LATERAL (SELECT MAX(m.fecha_cambio) AS fecha FROM historial_movimiento m
                          WHERE m.caja_fisica_id = a.caja_fisica_id AND m.estado_nuevo = 'Etapa 1' AND m.fecha_cambio < a.fecha_cambio) r ON r.fecha IS NOT NULL
            WHERE a.estado_nuevo = 'Etapa 5' AND a.fecha_cambio >= NOW() - make_interval(days => $1)
              AND a.fecha_cambio - r.fecha < INTERVAL '3 days'`, [dias]);

        const porDia = db.query(`
            SELECT TO_CHAR(DATE_TRUNC('day', fecha_cambio), 'YYYY-MM-DD') AS dia, COUNT(*)::int AS despachos
            FROM historial_movimiento
            WHERE estado_nuevo = 'Despachado' AND fecha_cambio >= NOW() - make_interval(days => $1)
            GROUP BY 1 ORDER BY 1`, [dias]);

        const [r2, r3, r6, r5, rc, rr, rt, rd] = await Promise.all([k2, k3, k6, k5, cargas, reprocesos, tiempoCiclo, porDia]);
        res.json({
            dias,
            k2: r2.rows[0],
            k3: r3.rows,
            k5: r5.rows[0],
            k6: r6.rows[0],
            cargas: rc.rows,
            reprocesos: rr.rows[0],
            tiempo_ciclo_horas: rt.rows[0]?.horas === null || rt.rows[0]?.horas === undefined ? null : Number(rt.rows[0].horas),
            despachos_por_dia: rd.rows,
        });
    } catch (err) {
        console.error('Error al calcular indicadores:', err);
        res.status(500).json({ error: 'Error al calcular indicadores' });
    }
};

module.exports = { getIndicadores };
