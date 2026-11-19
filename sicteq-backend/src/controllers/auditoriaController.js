const db = require('../config/db');

const nullable = (v) => (v === undefined || v === '' ? null : v);

// PB-01: consulta del registro de auditoría, filtrable por usuario, acción y fechas.
const getAuditoria = async (req, res) => {
    const usuarioId = nullable(req.query.usuario_id);
    const accion = nullable(req.query.accion);
    const desde = nullable(req.query.desde);
    const hasta = nullable(req.query.hasta);
    const limite = Math.min(Number(req.query.limite) || 200, 1000);

    try {
        const result = await db.query(`
            SELECT a.id, a.fecha, a.accion, a.entidad, a.entidad_id, a.detalle, a.ip,
                   u.nombre AS usuario, r.nombre AS rol
            FROM auditoria a
            LEFT JOIN usuario u ON u.id = a.usuario_id
            LEFT JOIN rol r ON r.id = u.rol_id
            WHERE ($1::int IS NULL OR a.usuario_id = $1)
              AND ($2::text IS NULL OR a.accion = $2)
              AND ($3::timestamp IS NULL OR a.fecha >= $3)
              AND ($4::timestamp IS NULL OR a.fecha <= $4)
            ORDER BY a.fecha DESC
            LIMIT $5
        `, [usuarioId, accion, desde, hasta, limite]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al consultar auditoría:', err);
        res.status(500).json({ error: 'Error al consultar auditoría' });
    }
};

module.exports = { getAuditoria };
