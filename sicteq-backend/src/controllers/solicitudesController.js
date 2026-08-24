const db = require('../config/db');

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
    const { usuario_id, area_id, tipo_cirugia, instrumental, observaciones } = req.body;

    try {
        const obsFinal = `[Instrumental Requerido: ${instrumental}] ${observaciones ? '- ' + observaciones : ''}`;

        const result = await db.query(
            `INSERT INTO solicitud (usuario_id, area_id, estado, tipo_cirugia, observaciones)
             VALUES ($1, $2, 'Pendiente', $3, $4) RETURNING id`,
            [usuario_id, area_id, tipo_cirugia, obsFinal]
        );

        res.json({ message: 'Solicitud creada con éxito', id: result.rows[0].id });
    } catch (error) {
        console.error("Error al crear solicitud:", error);
        res.status(500).json({ error: 'Error interno del servidor al crear solicitud' });
    }
};

// PUT: Despachar la solicitud, asignarle una caja y registrar el movimiento
const despacharSolicitud = async (req, res) => {
    const { id } = req.params;
    const { caja_codigo, usuario_id } = req.body; 

    try {
        // 1. Iniciamos transacción
        await db.query('BEGIN');

        // 2. Buscamos la caja FÍSICA individual por su código (ej. CAJA-0045),
        // no el tipo/categoría (inventario.codigo_barra, ej. GEN-001). El TENS
        // despacha una unidad física concreta, no "un tipo de caja".
        const cajaResult = await db.query(
            "SELECT id, inventario_id FROM CAJA_FISICA WHERE codigo_caja = $1 LIMIT 1",
            [caja_codigo]
        );

        if (cajaResult.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: `No se encontró ninguna caja con el código "${caja_codigo}"` });
        }

        const { id: caja_fisica_id, inventario_id } = cajaResult.rows[0];

        // 2b. Descontamos el stock disponible del tipo de caja despachado.
        // Antes esto nunca se tocaba: el inventario mostrado no reflejaba
        // los despachos reales, sin importar cuántos hubiera.
        await db.query(
            "UPDATE inventario SET cantidad_disponible = GREATEST(cantidad_disponible - 1, 0) WHERE id = $1",
            [inventario_id]
        );

        // 3. Actualizamos el estado de la solicitud
        const result = await db.query(
            "UPDATE solicitud SET estado = 'Despachado' WHERE id = $1 RETURNING id",
            [id]
        );

        if (result.rowCount === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }

        // 4. Registramos el movimiento en el historial
        await db.query(
            `INSERT INTO HISTORIAL_MOVIMIENTO (inventario_id, caja_fisica_id, area_destino_id, estado_nuevo, justificacion, fecha_cambio)
             VALUES (
                $1,
                $2,
                (SELECT area_id FROM SOLICITUD WHERE id = $3),
                'Despachado',
                $4,
                NOW()
             )`,
            [inventario_id, caja_fisica_id, id, `Despacho de caja ${caja_codigo} para solicitud REQ-${id}`]
        );

        await db.query('COMMIT');
        res.json({ message: 'Solicitud despachada y movimiento registrado con éxito' });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Error al despachar solicitud:", error);
        res.status(500).json({ error: 'Error interno del servidor al despachar' });
    }
};

module.exports = { getSolicitudes, getAreas, crearSolicitud, despacharSolicitud };