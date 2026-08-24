const db = require('../config/db');

const buscarCaja = async (req, res) => {
    const codigo = String(req.params.codigo || '').trim().toUpperCase();

    if (!codigo) {
        return res.status(400).json({ message: "Código de caja inválido" });
    }

    try {
        const invResult = await db.query(
            "SELECT id FROM INVENTARIO WHERE codigo_barra = $1 LIMIT 1",
            [codigo]
        );

        if (invResult.rows.length === 0) {
            return res.status(404).json({ message: `No se encontró ninguna caja con el código "${codigo}"` });
        }

        const inventario_id = invResult.rows[0].id;

        const result = await db.query(`
            SELECT h.*, a.nombre AS destino_nombre
            FROM HISTORIAL_MOVIMIENTO h
            LEFT JOIN AREA a ON h.area_destino_id = a.id
            WHERE h.inventario_id = $1
            ORDER BY h.fecha_cambio DESC
        `, [inventario_id]);

        res.json(result.rows);
    } catch (err) {
        console.error("Error al buscar caja:", err);
        res.status(500).json({ error: err.message });
    }
};

const actualizarEtapa = async (req, res) => {
    const codigo = String(req.body.codigo || '').trim().toUpperCase();
    const { stage, reason } = req.body;

    // Validación de campos requeridos. El motivo (reason) es opcional al avanzar
    // de etapa -- el frontend solo lo exige para retrocesos; si viene vacío se usa
    // un texto por defecto (ver justificacionFinal mas abajo).
    if (!codigo || stage === undefined) {
        return res.status(400).json({ error: "Datos incompletos: se requiere codigo y stage." });
    }

    try {
        const invResult = await db.query(
            "SELECT id FROM INVENTARIO WHERE codigo_barra = $1 LIMIT 1",
            [codigo]
        );

        if (invResult.rows.length === 0) {
            return res.status(404).json({ error: `No se encontró ninguna caja con el código "${codigo}"` });
        }

        const inventario_id = invResult.rows[0].id;

        // Mantenemos el area_destino_id del ultimo movimiento registrado para esta
        // caja (si existe), ya que actualizarEtapa solo cambia la etapa del proceso,
        // no el area fisica de destino.
        const lastMove = await db.query(
            "SELECT area_destino_id FROM HISTORIAL_MOVIMIENTO WHERE inventario_id = $1 ORDER BY fecha_cambio DESC LIMIT 1",
            [inventario_id]
        );
        const area_destino_id = lastMove.rows[0]?.area_destino_id ?? null;

        // Formatear el estado y la justificación
        const estadoFormateado = typeof stage === 'string' ? stage : `Etapa ${stage}`;
        const justificacionFinal = (reason || '').trim() !== "" ? reason : `Avance a ${estadoFormateado}`;

        const query = `
            INSERT INTO HISTORIAL_MOVIMIENTO
            (inventario_id, estado_nuevo, fecha_cambio, area_destino_id, justificacion)
            VALUES ($1, $2, NOW(), $3, $4)
        `;

        const values = [inventario_id, estadoFormateado, area_destino_id, justificacionFinal];

        await db.query(query, values);

        res.json({ success: true, message: "Etapa actualizada correctamente" });
    } catch (err) {
        console.error(">>> [ERROR CRÍTICO] FALLO EN SQL:", err);
        res.status(500).json({ error: "Error al insertar en la base de datos: " + err.message });
    }
};

module.exports = {
    buscarCaja,
    actualizarEtapa
};
