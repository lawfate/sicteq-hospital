const db = require('../config/db');

const buscarCaja = async (req, res) => {
    const codigo = String(req.params.codigo || '').trim().toUpperCase();

    if (!codigo) {
        return res.status(400).json({ message: "Código de caja inválido" });
    }

    try {
        // Buscamos por la caja FÍSICA individual (caja_fisica.codigo_caja,
        // ej. CAJA-0045), no por el tipo/categoría (inventario.codigo_barra).
        const cajaResult = await db.query(
            "SELECT id FROM caja_fisica WHERE codigo_caja = $1 LIMIT 1",
            [codigo]
        );

        if (cajaResult.rows.length === 0) {
            return res.status(404).json({ message: `No se encontró ninguna caja con el código "${codigo}"` });
        }

        const caja_fisica_id = cajaResult.rows[0].id;

        const result = await db.query(`
            SELECT h.*, a.nombre AS destino_nombre
            FROM HISTORIAL_MOVIMIENTO h
            LEFT JOIN AREA a ON h.area_destino_id = a.id
            WHERE h.caja_fisica_id = $1
            ORDER BY h.fecha_cambio DESC
        `, [caja_fisica_id]);

        res.json(result.rows);
    } catch (err) {
        console.error("Error al buscar caja:", err);
        res.status(500).json({ error: err.message });
    }
};

// Etapa "Almacenamiento" del ciclo (ver steps en Ciclo.jsx) -- es el punto
// donde arranca a correr la vigencia del empaque estéril.
const ALMACENAMIENTO_STAGE_ID = 5;

const actualizarEtapa = async (req, res) => {
    const codigo = String(req.body.codigo || '').trim().toUpperCase();
    const { stage, reason, metodo, temperatura, presion, tiempoMinutos, vigenciaDias } = req.body;

    // Validación de campos requeridos. El motivo (reason) es opcional al avanzar
    // de etapa -- el frontend solo lo exige para retrocesos; si viene vacío se usa
    // un texto por defecto (ver justificacionFinal mas abajo).
    if (!codigo || stage === undefined) {
        return res.status(400).json({ error: "Datos incompletos: se requiere codigo y stage." });
    }

    try {
        const cajaResult = await db.query(
            "SELECT id, inventario_id FROM caja_fisica WHERE codigo_caja = $1 LIMIT 1",
            [codigo]
        );

        if (cajaResult.rows.length === 0) {
            return res.status(404).json({ error: `No se encontró ninguna caja con el código "${codigo}"` });
        }

        const { id: caja_fisica_id, inventario_id } = cajaResult.rows[0];

        // Mantenemos el area_destino_id del ultimo movimiento registrado para esta
        // caja (si existe), ya que actualizarEtapa solo cambia la etapa del proceso,
        // no el area fisica de destino.
        const lastMove = await db.query(
            "SELECT area_destino_id FROM HISTORIAL_MOVIMIENTO WHERE caja_fisica_id = $1 ORDER BY fecha_cambio DESC LIMIT 1",
            [caja_fisica_id]
        );
        const area_destino_id = lastMove.rows[0]?.area_destino_id ?? null;

        // Formatear el estado y la justificación
        const estadoFormateado = typeof stage === 'string' ? stage : `Etapa ${stage}`;
        const justificacionFinal = (reason || '').trim() !== "" ? reason : `Avance a ${estadoFormateado}`;

        // Los parámetros del ciclo de esterilización (método/temperatura/presión/
        // tiempo) solo llegan cuando el frontend los manda -- es decir, cuando la
        // etapa que se está registrando es "Esterilización". Para cualquier otra
        // etapa quedan en null.
        const query = `
            INSERT INTO HISTORIAL_MOVIMIENTO
            (inventario_id, caja_fisica_id, estado_nuevo, fecha_cambio, area_destino_id, justificacion,
             metodo_esterilizacion, temperatura, presion, tiempo_minutos)
            VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9)
        `;

        const values = [
            inventario_id, caja_fisica_id, estadoFormateado, area_destino_id, justificacionFinal,
            metodo || null,
            temperatura !== undefined && temperatura !== '' ? temperatura : null,
            presion || null,
            tiempoMinutos !== undefined && tiempoMinutos !== '' ? tiempoMinutos : null
        ];

        await db.query(query, values);

        // Al pasar por Almacenamiento, calculamos y guardamos la fecha de
        // caducidad del empaque (hoy + vigencia en días) para poder alertar
        // sobre rotación de stock. Vigencia por defecto: 30 días.
        if (Number(stage) === ALMACENAMIENTO_STAGE_ID) {
            const dias = Number(vigenciaDias) > 0 ? Number(vigenciaDias) : 30;
            await db.query(
                `UPDATE caja_fisica SET fecha_caducidad = NOW() + ($1 || ' days')::INTERVAL WHERE id = $2`,
                [dias, caja_fisica_id]
            );
        }

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
