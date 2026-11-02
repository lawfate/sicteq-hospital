const db = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoria');

const nullable = (v) => (v === undefined || v === '' ? null : v);

// GET: Listado completo de solicitudes, filtrable por área/estado/fecha. No
// existía ningún endpoint para esto -- la única vista era el bloque
// "críticas" del dashboard (solo pendientes, máximo 5).
const getSolicitudes = async (req, res) => {
    const areaId = nullable(req.query.area_id);
    const estado = nullable(req.query.estado);
    const desde = nullable(req.query.desde);
    const hasta = nullable(req.query.hasta);

    try {
        const result = await db.query(`
            SELECT s.id, s.fecha_creacion, s.estado, s.tipo_cirugia, s.observaciones,
                   a.nombre AS area_nombre, u.nombre AS usuario_nombre
            FROM solicitud s
            LEFT JOIN area a ON s.area_id = a.id
            LEFT JOIN usuario u ON s.usuario_id = u.id
            WHERE ($1::int IS NULL OR s.area_id = $1)
              AND ($2::text IS NULL OR s.estado = $2)
              AND ($3::timestamp IS NULL OR s.fecha_creacion >= $3)
              AND ($4::timestamp IS NULL OR s.fecha_creacion <= $4)
            ORDER BY s.fecha_creacion DESC
        `, [areaId, estado, desde, hasta]);

        res.json(result.rows);
    } catch (error) {
        console.error("Error al listar solicitudes:", error);
        res.status(500).json({ error: 'Error al listar solicitudes' });
    }
};

// GET: Obtener la lista de pabellones
const getAreas = async (req, res) => {
    try {
        const result = await db.query("SELECT id, nombre FROM area WHERE nombre LIKE '%Pabellón%' OR nombre LIKE '%Urgencia%' OR nombre LIKE '%UCI%' ORDER BY id ASC");
        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener áreas:", error);
        res.status(500).json({ error: 'Error al obtener áreas' });
    }
};

// POST: Guardar la nueva solicitud
const crearSolicitud = async (req, res) => {
    const { area_id, tipo_cirugia, instrumental, observaciones } = req.body;
    const usuario_id = req.user.id; // del token, no del body

    try {
        const obsFinal = `[Instrumental Requerido: ${instrumental}] ${observaciones ? '- ' + observaciones : ''}`;

        const result = await db.query(
            `INSERT INTO solicitud (usuario_id, area_id, estado, tipo_cirugia, observaciones)
             VALUES ($1, $2, 'Pendiente', $3, $4) RETURNING id`,
            [usuario_id, area_id, tipo_cirugia, obsFinal]
        );

        await registrarAuditoria(req, 'crear_solicitud', 'solicitud', result.rows[0].id, { area_id, tipo_cirugia });
        res.json({ message: 'Solicitud creada con éxito', id: result.rows[0].id });
    } catch (error) {
        console.error("Error al crear solicitud:", error);
        res.status(500).json({ error: 'Error interno del servidor al crear solicitud' });
    }
};

// PUT: Despachar la solicitud con una caja física concreta. Antes no se
// verificaba nada de la caja: se podía despachar una de una carga No estéril,
// con el empaque vencido o que ni siquiera estaba en bodega. Además usa una
// transacción real (cliente dedicado): BEGIN/COMMIT sobre el pool podían caer
// en conexiones distintas.
const despacharSolicitud = async (req, res) => {
    const id = Number(req.params.id);
    const caja_codigo = String(req.body.caja_codigo || '').trim().toUpperCase();
    const usuario_id = req.user.id; // del token, no del body

    if (!Number.isInteger(id) || id <= 0 || !caja_codigo) {
        return res.status(400).json({ error: 'Se requiere una solicitud válida y el código de la caja.' });
    }

    const rechazar = async (status, motivo) => {
        await registrarAuditoria(req, 'despacho_bloqueado', 'solicitud', id, { caja_codigo, motivo });
        return res.status(status).json({ error: motivo });
    };

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const sol = await client.query('SELECT id, estado, area_id FROM solicitud WHERE id = $1 FOR UPDATE', [id]);
        if (sol.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Solicitud no encontrada' }); }
        if (sol.rows[0].estado === 'Despachado') { await client.query('ROLLBACK'); return res.status(409).json({ error: `La solicitud REQ-${id} ya fue despachada.` }); }

        const caja = await client.query(`
            SELECT cf.id, cf.inventario_id, cf.fecha_caducidad,
                   (SELECT estado_nuevo FROM historial_movimiento h WHERE h.caja_fisica_id = cf.id ORDER BY h.fecha_cambio DESC, h.id DESC LIMIT 1) AS etapa,
                   (SELECT c.estado || '|M' || c.numero_maquina || '-C' || c.numero_ciclo
                      FROM vinculo_trazabilidad v JOIN ciclo_esterilizacion c ON c.id = v.ciclo_id
                     WHERE v.caja_fisica_id = cf.id ORDER BY v.fecha DESC, v.id DESC LIMIT 1) AS carga
            FROM caja_fisica cf WHERE cf.codigo_caja = $1 LIMIT 1`, [caja_codigo]);
        if (caja.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: `No se encontró ninguna caja con el código "${caja_codigo}"` }); }
        const k = caja.rows[0];

        // Reglas de seguridad del paciente: solo sale de la Central una caja
        // almacenada, de una carga liberada como Estéril y con empaque vigente.
        if (k.etapa !== 'Etapa 5') {
            await client.query('ROLLBACK');
            return rechazar(409, `La caja ${caja_codigo} no está en Almacenamiento (estado actual: ${k.etapa || 'sin movimientos'}). Solo se despachan cajas estériles almacenadas.`);
        }
        if (k.carga && !k.carga.startsWith('Estéril|')) {
            const [estado, carga] = k.carga.split('|');
            await client.query('ROLLBACK');
            return rechazar(409, `La caja ${caja_codigo} pertenece a la carga ${carga} con estado "${estado}". No se puede despachar.`);
        }
        if (!k.fecha_caducidad || new Date(k.fecha_caducidad) <= new Date()) {
            await client.query('ROLLBACK');
            return rechazar(409, k.fecha_caducidad
                ? `El empaque de la caja ${caja_codigo} está vencido. Debe reprocesarse antes de despacharla.`
                : `La caja ${caja_codigo} no tiene fecha de caducidad registrada. Regístrela en Almacenamiento antes de despacharla.`);
        }

        // Descuenta el stock disponible del tipo de caja despachado.
        await client.query('UPDATE inventario SET cantidad_disponible = GREATEST(cantidad_disponible - 1, 0) WHERE id = $1', [k.inventario_id]);
        await client.query("UPDATE solicitud SET estado = 'Despachado' WHERE id = $1", [id]);
        await client.query(
            `INSERT INTO historial_movimiento (inventario_id, caja_fisica_id, area_destino_id, estado_anterior, estado_nuevo, justificacion, fecha_cambio, usuario_id, solicitud_id)
             VALUES ($1, $2, $3, $4, 'Despachado', $5, NOW(), $6, $7)`,
            [k.inventario_id, k.id, sol.rows[0].area_id, k.etapa, `Despacho de caja ${caja_codigo} para solicitud REQ-${id}`, usuario_id, id]);

        await client.query('COMMIT');
        await registrarAuditoria(req, 'despachar_solicitud', 'solicitud', id, { caja_codigo });
        res.json({ message: 'Solicitud despachada y movimiento registrado con éxito' });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error("Error al despachar solicitud:", error);
        res.status(500).json({ error: 'Error interno del servidor al despachar' });
    } finally {
        client.release();
    }
};

module.exports = { getSolicitudes, getAreas, crearSolicitud, despacharSolicitud };