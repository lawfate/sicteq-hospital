const db = require('../config/db');

// Alertas proactivas: antes había que entrar a Inventario a mirar. Junta
// stock bajo/crítico y cajas físicas cuyo empaque estéril está por vencer
// (o ya venció), para que el Dashboard las muestre sin navegar a ningún lado.
const getAlertas = async (req, res) => {
    try {
        // Las dos consultas son independientes: en paralelo (PB-08, prueba de carga).
        const [stockBajo, cajasPorVencer] = await Promise.all([db.query(`
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
        `)]);

        res.json({
            stockBajo: stockBajo.rows,
            cajasPorVencer: cajasPorVencer.rows
        });
    } catch (err) {
        console.error("Error al obtener alertas:", err);
        res.status(500).json({ error: "Error al obtener alertas" });
    }
};

module.exports = { getAlertas };
