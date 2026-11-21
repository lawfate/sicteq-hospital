const db = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoria');
const { entero } = require('../utils/validacion');

// Cajas físicas en circulación: cada fila es una unidad individual
// (codigo_caja, ej. CAJA-0045), no un tipo/categoría (eso es INVENTARIO).
const getCajasEnCirculacion = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                cf.id,
                cf.codigo_caja,
                cf.estado,
                cf.fecha_creacion,
                i.nombre_equipo,
                i.codigo_barra AS tipo_codigo,
                ultimo.estado_nuevo,
                ultimo.fecha_cambio AS ultima_actualizacion,
                ultimo.destino_nombre
            FROM caja_fisica cf
            JOIN inventario i ON cf.inventario_id = i.id
            LEFT JOIN LATERAL (
                SELECT h.estado_nuevo, h.fecha_cambio, a.nombre AS destino_nombre
                FROM historial_movimiento h
                LEFT JOIN area a ON h.area_destino_id = a.id
                WHERE h.caja_fisica_id = cf.id
                ORDER BY h.fecha_cambio DESC
                LIMIT 1
            ) ultimo ON true
            WHERE cf.estado = 'En circulación'
            ORDER BY cf.codigo_caja ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener cajas en circulación:", err);
        res.status(500).json({ error: "Error al obtener cajas en circulación" });
    }
};

// Dirección inversa de la trazabilidad clínica: dado el código de una caja
// física, qué paciente(s) se le vincularon. Es la mitad que faltaba --
// antes solo se podía ir paciente -> cajas, nunca caja -> paciente.
const getPacientesDeCaja = async (req, res) => {
    const codigo = String(req.params.codigo || '').trim().toUpperCase();

    if (!codigo) {
        return res.status(400).json({ error: "Código de caja inválido" });
    }

    try {
        const cajaRes = await db.query('SELECT id FROM caja_fisica WHERE codigo_caja = $1 LIMIT 1', [codigo]);
        if (cajaRes.rows.length === 0) {
            return res.status(404).json({ error: `No se encontró ninguna caja con el código "${codigo}"` });
        }

        const result = await db.query(`
            SELECT v.id, v.fecha_vinculo, p.rut, p.nombre, p.diagnostico, u.nombre AS vinculado_por
            FROM vinculo_caja_paciente v
            JOIN paciente p ON v.paciente_id = p.id
            LEFT JOIN usuario u ON v.usuario_id = u.id
            WHERE v.caja_fisica_id = $1
            ORDER BY v.fecha_vinculo DESC
        `, [cajaRes.rows[0].id]);

        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener pacientes de la caja:", err);
        res.status(500).json({ error: "Error al obtener pacientes vinculados a la caja" });
    }
};

const getCajas = async (req, res) => {
    const inventario_id = entero(req.query.inventario_id);
    if (inventario_id === null) return res.status(400).json({ error: 'inventario_id es obligatorio y debe ser un entero positivo.' });
    try {
        const result = await db.query(`SELECT cf.codigo_caja, cf.estado, e.codigo AS estante,
            (SELECT h.estado_nuevo FROM historial_movimiento h WHERE h.caja_fisica_id = cf.id
             ORDER BY h.fecha_cambio DESC, h.id DESC LIMIT 1) AS estado_nuevo
            FROM caja_fisica cf LEFT JOIN estante e ON e.id = cf.estante_id
            WHERE cf.inventario_id = $1 ORDER BY cf.codigo_caja`, [inventario_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al cargar cajas' });
    }
};

const getCaja = async (req, res) => {
    const codigo = req.params.codigo.trim().toUpperCase();
    try {
        const result = await db.query(`SELECT cf.codigo_caja, cf.estado, i.nombre_equipo AS tipo,
            i.codigo_barra AS tipo_codigo, i.piezas, e.codigo AS estante, cf.fecha_caducidad
            FROM caja_fisica cf JOIN inventario i ON i.id = cf.inventario_id
            LEFT JOIN estante e ON e.id = cf.estante_id WHERE cf.codigo_caja = $1`, [codigo]);
        if (!result.rowCount) return res.status(404).json({ error: 'Caja no encontrada' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al cargar caja' });
    }
};

const crearCaja = async (req, res) => {
    const inventario_id = entero(req.body?.inventario_id);
    if (inventario_id === null) return res.status(400).json({ error: 'inventario_id debe ser un entero positivo.' });
    let client;
    try {
        client = await db.connect();
        await client.query('BEGIN');
        // Serializa el cálculo del código, incluso con altas simultáneas.
        await client.query('LOCK TABLE caja_fisica IN SHARE ROW EXCLUSIVE MODE');
        const tipo = await client.query('SELECT id FROM inventario WHERE id = $1 FOR UPDATE', [inventario_id]);
        if (!tipo.rowCount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'El inventario_id indicado no existe.' });
        }
        const siguiente = await client.query(`SELECT COALESCE(MAX(SUBSTRING(codigo_caja FROM 6)::numeric), 0) + 1 AS numero
            FROM caja_fisica WHERE codigo_caja ~ '^CAJA-[0-9]+$'`);
        const codigo = `CAJA-${String(siguiente.rows[0].numero).padStart(4, '0')}`;
        const result = await client.query(`INSERT INTO caja_fisica (inventario_id, codigo_caja, estado, fecha_creacion)
            VALUES ($1, $2, 'En circulación', NOW()) RETURNING *`, [inventario_id, codigo]);
        const caja = result.rows[0];
        await client.query('UPDATE inventario SET cantidad_total = cantidad_total + 1 WHERE id = $1', [inventario_id]);
        await client.query(`INSERT INTO historial_movimiento
            (inventario_id, caja_fisica_id, estado_nuevo, justificacion, usuario_id, fecha_cambio)
            VALUES ($1, $2, 'Etapa 1', 'Alta de caja nueva', $3, NOW())`, [inventario_id, caja.id, req.user.id]);
        await client.query('COMMIT');
        await registrarAuditoria(req, 'crear_caja', 'caja_fisica', caja.id, { codigo_caja: codigo, inventario_id });
        res.status(201).json(caja);
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        if (err.code === '23505') return res.status(409).json({ error: 'El código de caja ya existe.' });
        res.status(500).json({ error: 'Error al crear caja' });
    } finally {
        if (client) client.release();
    }
};

const darBaja = async (req, res) => {
    const codigo = req.params.codigo.trim().toUpperCase();
    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
    if (motivo.length < 3 || motivo.length > 200) return res.status(400).json({ error: 'El motivo debe tener entre 3 y 200 caracteres.' });
    let client;
    try {
        client = await db.connect();
        await client.query('BEGIN');
        const result = await client.query('SELECT id, inventario_id, estado FROM caja_fisica WHERE codigo_caja = $1 FOR UPDATE', [codigo]);
        if (!result.rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Caja no encontrada' });
        }
        const caja = result.rows[0];
        if (caja.estado === 'De baja') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'La caja ya está de baja.' });
        }
        await client.query("UPDATE caja_fisica SET estado = 'De baja', fecha_eliminacion = NOW(), estante_id = NULL WHERE id = $1", [caja.id]);
        await client.query('UPDATE inventario SET cantidad_total = GREATEST(cantidad_total - 1, 0) WHERE id = $1', [caja.inventario_id]);
        await client.query('COMMIT');
        await registrarAuditoria(req, 'baja_caja', 'caja_fisica', caja.id, { codigo_caja: codigo, motivo });
        res.json({ codigo_caja: codigo, estado: 'De baja' });
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Error al dar de baja la caja' });
    } finally {
        if (client) client.release();
    }
};

const ubicarCaja = async (req, res) => {
    const codigo = req.params.codigo.trim().toUpperCase();
    const estante = typeof req.body?.estante === 'string' ? req.body.estante.trim().toUpperCase() : '';
    if (!/^EST-[A-Z0-9]{1,6}$/.test(estante)) return res.status(400).json({ error: 'Código de estante inválido.' });
    let client;
    try {
        client = await db.connect();
        await client.query('BEGIN');
        const result = await client.query('SELECT id, estado FROM caja_fisica WHERE codigo_caja = $1 FOR UPDATE', [codigo]);
        if (!result.rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Caja no encontrada' });
        }
        const caja = result.rows[0];
        const ultimo = await client.query(`SELECT estado_nuevo FROM historial_movimiento WHERE caja_fisica_id = $1
            ORDER BY fecha_cambio DESC, id DESC LIMIT 1`, [caja.id]);
        if (caja.estado === 'De baja' || ultimo.rows[0]?.estado_nuevo !== 'Etapa 5') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `La caja ${codigo} no está en Bodega estéril` });
        }
        const destino = await client.query('SELECT id FROM estante WHERE codigo = $1 AND activo = true FOR SHARE', [estante]);
        if (!destino.rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Estante activo no encontrado' });
        }
        await client.query('UPDATE caja_fisica SET estante_id = $2 WHERE id = $1', [caja.id, destino.rows[0].id]);
        await client.query('COMMIT');
        await registrarAuditoria(req, 'ubicar_caja', 'caja_fisica', caja.id, { estante });
        res.json({ codigo_caja: codigo, estante });
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Error al ubicar caja' });
    } finally {
        if (client) client.release();
    }
};

module.exports = { getCajasEnCirculacion, getPacientesDeCaja, getCajas, getCaja, crearCaja, darBaja, ubicarCaja };
