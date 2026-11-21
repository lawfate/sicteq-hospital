const db = require('../config/db');

// Alertas proactivas: antes había que entrar a Inventario a mirar. Junta
// stock bajo/crítico y cajas físicas cuyo empaque estéril está por vencer
// (o ya venció), para que el Dashboard las muestre sin navegar a ningún lado.
const getAlertas = async (req, res) => {
    try {
        // Consultas independientes en paralelo (PB-08, prueba de carga).
        const [stockBajo, cajasPorVencer, cargasDemoradas, incidencias] = await Promise.all([db.query(`
            SELECT id, nombre_equipo, codigo_barra, cantidad_disponible, cantidad_total, stock_critico, estado_actual
            FROM inventario
            WHERE cantidad_disponible <= stock_critico OR estado_actual IN ('Alerta', 'Merma', 'En Reparación')
            ORDER BY cantidad_disponible ASC
        `), db.query(`
            SELECT cf.id, cf.codigo_caja, cf.fecha_caducidad, i.nombre_equipo,
                   ((cf.fecha_caducidad AT TIME ZONE 'UTC' AT TIME ZONE 'America/Santiago')::date
                    - (NOW() AT TIME ZONE 'America/Santiago')::date) AS dias_restantes
            FROM caja_fisica cf
            JOIN inventario i ON cf.inventario_id = i.id
            WHERE cf.estado = 'En circulación'
              AND cf.fecha_caducidad IS NOT NULL
              AND cf.fecha_caducidad <= NOW() + INTERVAL '7 days'
            ORDER BY cf.fecha_caducidad ASC
        `), db.query(`
            SELECT id, numero_maquina, numero_ciclo, fecha_inicio,
                   FLOOR(EXTRACT(EPOCH FROM (NOW() - fecha_inicio)) / 3600)::int AS horas
            FROM ciclo_esterilizacion
            WHERE estado = 'En proceso' AND fecha_inicio < NOW() - INTERVAL '3 hours'
            ORDER BY fecha_inicio ASC
        `), db.query(`
            SELECT inc.id, cf.codigo_caja, i.nombre_equipo AS tipo, inc.piezas_esperadas, inc.piezas_contadas, inc.fecha
            FROM incidencia inc JOIN caja_fisica cf ON cf.id = inc.caja_fisica_id
            JOIN inventario i ON i.id = cf.inventario_id
            WHERE inc.fecha_resolucion IS NULL ORDER BY inc.fecha ASC, inc.id ASC
        `)]);

        res.json({
            stockBajo: stockBajo.rows,
            cajasPorVencer: cajasPorVencer.rows,
            cargasDemoradas: cargasDemoradas.rows,
            incidencias: incidencias.rows
        });
    } catch (err) {
        console.error("Error al obtener alertas:", err);
        res.status(500).json({ error: "Error al obtener alertas" });
    }
};

module.exports = { getAlertas };
