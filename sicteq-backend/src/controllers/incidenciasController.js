const db = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoria');
const { entero } = require('../utils/validacion');

const resolverIncidencia = async (req, res) => {
    const id = entero(req.params.id);
    const resolucion = typeof req.body?.resolucion === 'string' ? req.body.resolucion.trim() : '';
    if (id === null || resolucion.length < 3 || resolucion.length > 255) return res.status(400).json({ error: 'Se requiere un id válido y una resolución de 3 a 255 caracteres.' });
    let client;
    try {
        client = await db.connect();
        await client.query('BEGIN');
        const incidencia = await client.query('SELECT id, fecha_resolucion FROM incidencia WHERE id = $1 FOR UPDATE', [id]);
        if (!incidencia.rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Incidencia no encontrada' });
        }
        if (incidencia.rows[0].fecha_resolucion !== null) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'La incidencia ya estaba resuelta.' });
        }
        const result = await client.query(`UPDATE incidencia SET resuelta_por = $2, fecha_resolucion = NOW(), resolucion = $3
            WHERE id = $1 RETURNING id, resuelta_por, fecha_resolucion, resolucion`, [id, req.user.id, resolucion]);
        await client.query('COMMIT');
        await registrarAuditoria(req, 'resolver_incidencia', 'incidencia', id, { resolucion });
        res.json(result.rows[0]);
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Error al resolver incidencia' });
    } finally {
        if (client) client.release();
    }
};

module.exports = { resolverIncidencia };
