const db = require('../config/db');

// Convierte '' (query param vacío) en null para que los filtros opcionales
// funcionen con el patrón "$1::tipo IS NULL OR columna = $1" sin condicionales.
const nullable = (v) => (v === undefined || v === '' ? null : v);

// Reporte de trazabilidad: historial de movimientos filtrable por caja física
// y rango de fechas -- el ciclo completo de cada caja, no solo los últimos 5
// que muestra el Dashboard.
const getReporteTrazabilidad = async (req, res) => {
    const codigo = nullable(req.query.codigo ? String(req.query.codigo).trim().toUpperCase() : undefined);
    const desde = nullable(req.query.desde);
    const hasta = nullable(req.query.hasta);

    try {
        const result = await db.query(`
            SELECT h.id, cf.codigo_caja, i.nombre_equipo, h.estado_nuevo, h.justificacion,
                   h.fecha_cambio, a.nombre AS destino_nombre,
                   h.metodo_esterilizacion, h.temperatura, h.presion, h.tiempo_minutos
            FROM historial_movimiento h
            LEFT JOIN caja_fisica cf ON h.caja_fisica_id = cf.id
            LEFT JOIN inventario i ON h.inventario_id = i.id
            LEFT JOIN area a ON h.area_destino_id = a.id
            WHERE ($1::text IS NULL OR cf.codigo_caja = $1)
              AND ($2::timestamp IS NULL OR h.fecha_cambio >= $2)
              AND ($3::timestamp IS NULL OR h.fecha_cambio <= $3)
            ORDER BY h.fecha_cambio DESC
        `, [codigo, desde, hasta]);

        res.json(result.rows);
    } catch (err) {
        console.error("Error al generar reporte de trazabilidad:", err);
        res.status(500).json({ error: "Error al generar reporte de trazabilidad" });
    }
};

// Reporte de vínculos clínicos: qué paciente usó qué caja y cuándo -- la
// evidencia directa para la justificación de prevención de IAAS del proyecto.
const getReporteVinculos = async (req, res) => {
    const rut = nullable(req.query.rut ? String(req.query.rut).trim() : undefined);
    const codigo = nullable(req.query.codigo ? String(req.query.codigo).trim().toUpperCase() : undefined);
    const desde = nullable(req.query.desde);
    const hasta = nullable(req.query.hasta);

    try {
        const result = await db.query(`
            SELECT v.id, v.fecha_vinculo, p.rut, p.nombre AS paciente_nombre, p.diagnostico, p.alertas_iaas,
                   cf.codigo_caja, i.nombre_equipo, u.nombre AS vinculado_por
            FROM vinculo_caja_paciente v
            JOIN paciente p ON v.paciente_id = p.id
            JOIN caja_fisica cf ON v.caja_fisica_id = cf.id
            LEFT JOIN inventario i ON cf.inventario_id = i.id
            LEFT JOIN usuario u ON v.usuario_id = u.id
            WHERE ($1::text IS NULL OR p.rut = $1)
              AND ($2::text IS NULL OR cf.codigo_caja = $2)
              AND ($3::timestamp IS NULL OR v.fecha_vinculo >= $3)
              AND ($4::timestamp IS NULL OR v.fecha_vinculo <= $4)
            ORDER BY v.fecha_vinculo DESC
        `, [rut, codigo, desde, hasta]);

        res.json(result.rows);
    } catch (err) {
        console.error("Error al generar reporte de vínculos clínicos:", err);
        res.status(500).json({ error: "Error al generar reporte de vínculos clínicos" });
    }
};

module.exports = { getReporteTrazabilidad, getReporteVinculos };
