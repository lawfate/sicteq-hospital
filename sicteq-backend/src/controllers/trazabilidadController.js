const db = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoria');

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
const ENTREGA_STAGE_ID = 6;
// PB-05: el hospital usa 1 año de vigencia para todo empaque (reunión 31-08).
// Configurable por variable de entorno; cada registro puede mandar la suya.
const VIGENCIA_DIAS_DEFAULT = Number(process.env.VIGENCIA_DIAS_DEFAULT) > 0 ? Number(process.env.VIGENCIA_DIAS_DEFAULT) : 365;

const etapaDe = (estado) => {
    const m = String(estado || '').match(/Etapa\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
};

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
            "SELECT area_destino_id, estado_nuevo FROM HISTORIAL_MOVIMIENTO WHERE caja_fisica_id = $1 ORDER BY fecha_cambio DESC LIMIT 1",
            [caja_fisica_id]
        );
        const area_destino_id = lastMove.rows[0]?.area_destino_id ?? null;
        const etapaActual = etapaDe(lastMove.rows[0]?.estado_nuevo);
        const etapaNueva = Number(stage);
        const esRetroceso = etapaActual !== null && etapaNueva < etapaActual;

        if (!esRetroceso && (etapaNueva === ALMACENAMIENTO_STAGE_ID || etapaNueva === ENTREGA_STAGE_ID)) {
            // Requerimiento 1: antes esta regla vivía solo en Ciclo.jsx y se
            // saltaba llamando directo a la API.
            const hayParametros = [temperatura, presion, tiempoMinutos].some(v => v !== undefined && v !== null && String(v).trim() !== '');
            if (!hayParametros && !(reason || '').trim()) {
                return res.status(400).json({ error: 'Para pasar a Almacenamiento o Entrega se requieren los parámetros de esterilización o un comentario que justifique su ausencia.' });
            }

            // PB-04: una caja solo avanza si su carga más reciente fue liberada
            // como "Estéril". Una carga En proceso o No estéril la bloquea.
            const carga = await db.query(`
                SELECT c.id, c.numero_maquina, c.numero_ciclo, c.estado
                FROM vinculo_trazabilidad v
                JOIN ciclo_esterilizacion c ON c.id = v.ciclo_id
                WHERE v.caja_fisica_id = $1
                ORDER BY v.fecha DESC, v.id DESC LIMIT 1
            `, [caja_fisica_id]);
            // shortcut: cajas sin ninguna carga registrada (flujo previo al sprint 2) pasan sin bloqueo; exigir carga cuando la Central use el módulo de autoclave a diario.
            const ultima = carga.rows[0];
            if (ultima && ultima.estado !== 'Estéril') {
                await registrarAuditoria(req, 'etapa_bloqueada', 'caja_fisica', codigo, { etapa: etapaNueva, carga: `M${ultima.numero_maquina}-C${ultima.numero_ciclo}`, estado_carga: ultima.estado });
                return res.status(409).json({ error: `La caja ${codigo} pertenece a la carga M${ultima.numero_maquina}-C${ultima.numero_ciclo} con estado "${ultima.estado}". No puede pasar a Almacenamiento ni Entrega hasta que una carga suya sea liberada como Estéril.` });
            }
        }

        // Formatear el estado y la justificación
        const estadoFormateado = typeof stage === 'string' ? stage : `Etapa ${stage}`;
        const justificacionFinal = (reason || '').trim() !== "" ? reason : `Avance a ${estadoFormateado}`;

        // Los parámetros del ciclo de esterilización (método/temperatura/presión/
        // tiempo) solo llegan cuando el frontend los manda -- es decir, cuando la
        // etapa que se está registrando es "Esterilización". Para cualquier otra
        // etapa quedan en null.
        const query = `
            INSERT INTO HISTORIAL_MOVIMIENTO
            (inventario_id, caja_fisica_id, estado_anterior, estado_nuevo, fecha_cambio, area_destino_id, justificacion,
             metodo_esterilizacion, temperatura, presion, tiempo_minutos, usuario_id)
            VALUES ($1, $2, $10, $3, NOW(), $4, $5, $6, $7, $8, $9, $11)
        `;

        const values = [
            inventario_id, caja_fisica_id, estadoFormateado, area_destino_id, justificacionFinal,
            metodo || null,
            temperatura !== undefined && temperatura !== '' ? temperatura : null,
            presion || null,
            tiempoMinutos !== undefined && tiempoMinutos !== '' ? tiempoMinutos : null,
            lastMove.rows[0]?.estado_nuevo ?? null,
            req.user.id
        ];

        await db.query(query, values);

        // Al pasar por Almacenamiento, calculamos y guardamos la fecha de
        // caducidad del empaque (hoy + vigencia en días) para poder alertar
        // sobre rotación de stock. Vigencia por defecto: VIGENCIA_DIAS_DEFAULT.
        if (Number(stage) === ALMACENAMIENTO_STAGE_ID) {
            const dias = Number(vigenciaDias) > 0 ? Number(vigenciaDias) : VIGENCIA_DIAS_DEFAULT;
            await db.query(
                `UPDATE caja_fisica SET fecha_caducidad = NOW() + ($1 || ' days')::INTERVAL WHERE id = $2`,
                [dias, caja_fisica_id]
            );
        }

        await registrarAuditoria(req, 'cambio_etapa', 'caja_fisica', codigo, {
            desde: lastMove.rows[0]?.estado_nuevo ?? null, hacia: estadoFormateado, retroceso: esRetroceso, motivo: (reason || '').trim() || null
        });
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
