const db = require('../config/db');

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

        // 2. Actualizamos el estado de la solicitud
        const result = await db.query(
            "UPDATE solicitud SET estado = 'Despachado' WHERE id = $1 RETURNING id",
            [id]
        );

        if (result.rowCount === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }

        // 3. REGISTRAMOS EL MOVIMIENTO EN EL HISTORIAL
        // Nota: Asumimos que el inventario existe; la subconsulta busca por nombre_equipo
        await db.query(
            `INSERT INTO HISTORIAL_MOVIMIENTO (inventario_id, area_destino_id, estado_nuevo, justificacion, fecha_cambio)
             VALUES (
                (SELECT id FROM INVENTARIO WHERE nombre_equipo = $1 LIMIT 1), 
                (SELECT area_id FROM SOLICITUD WHERE id = $2), 
                'Despachado', 
                $3, 
                NOW()
             )`,
            [caja_codigo, id, `Despacho de caja ${caja_codigo} para solicitud REQ-${id}`]
        );

        await db.query('COMMIT');
        res.json({ message: 'Solicitud despachada y movimiento registrado con éxito' });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Error al despachar solicitud:", error);
        res.status(500).json({ error: 'Error interno del servidor al despachar' });
    }
};

module.exports = { getAreas, crearSolicitud, despacharSolicitud };