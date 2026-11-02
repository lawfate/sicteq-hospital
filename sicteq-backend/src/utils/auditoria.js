const db = require('../config/db');

// PB-01: registra quién hizo qué y cuándo. Si la escritura de auditoría
// falla, se loguea pero no se tumba la acción del usuario (que ya se guardó).
const registrarAuditoria = async (req, accion, entidad = null, entidadId = null, detalle = null, usuarioId = null) => {
    try {
        await db.query(
            `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, ip)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                usuarioId ?? req.user?.id ?? null,
                accion,
                entidad,
                entidadId === null ? null : String(entidadId),
                detalle ? JSON.stringify(detalle) : null,
                req.ip || null
            ]
        );
    } catch (err) {
        console.error('>>> [AUDITORIA] No se pudo registrar', accion, err.message);
    }
};

module.exports = { registrarAuditoria };
