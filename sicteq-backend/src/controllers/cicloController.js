const db = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoria');

// PB-04: registro de la carga de autoclave. Identificador único de la carga =
// N° de máquina + N° de ciclo (el mismo del voucher). Cada caja física queda
// asociada a su carga; una carga "No estéril" devuelve sus cajas a Lavado y
// las bloquea para Almacenamiento/Entrega (ver trazabilidadController).

const ESTERILIZACION_STAGE = 'Etapa 4';
const LAVADO_STAGE = 'Etapa 2';
const RESULTADOS = ['Estéril', 'No estéril'];
const etiqueta = (c) => `M${c.numero_maquina}-C${c.numero_ciclo}`;

const listarCiclos = async (req, res) => {
    const maquina = req.query.maquina ? Number(req.query.maquina) : null;
    const numero = req.query.numero ? Number(req.query.numero) : null;
    try {
        const result = await db.query(`
            SELECT c.id, c.numero_maquina, c.numero_ciclo, c.metodo, c.temperatura, c.presion, c.tiempo_minutos,
                   c.estado, c.fecha_inicio, c.fecha_fin, c.observacion,
                   op.nombre AS operador, lib.nombre AS liberado_por,
                   COUNT(v.id)::int AS cantidad_cajas
            FROM ciclo_esterilizacion c
            LEFT JOIN usuario op ON op.id = c.operador_id
            LEFT JOIN usuario lib ON lib.id = c.liberado_por
            LEFT JOIN vinculo_trazabilidad v ON v.ciclo_id = c.id
            WHERE c.numero_ciclo IS NOT NULL
              AND ($1::int IS NULL OR c.numero_maquina = $1)
              AND ($2::int IS NULL OR c.numero_ciclo = $2)
            GROUP BY c.id, op.nombre, lib.nombre
            ORDER BY c.fecha_inicio DESC
            LIMIT 100
        `, [maquina, numero]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al listar ciclos:', err);
        res.status(500).json({ error: 'Error al listar ciclos' });
    }
};

const detalleCiclo = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id de ciclo inválido' });
    try {
        const c = await db.query('SELECT * FROM ciclo_esterilizacion WHERE id = $1', [id]);
        if (c.rows.length === 0) return res.status(404).json({ error: 'Ciclo no encontrado' });
        const cajas = await db.query(`
            SELECT cf.codigo_caja, i.nombre_equipo, v.resultado, v.fecha
            FROM vinculo_trazabilidad v
            JOIN caja_fisica cf ON cf.id = v.caja_fisica_id
            JOIN inventario i ON i.id = cf.inventario_id
            WHERE v.ciclo_id = $1
            ORDER BY cf.codigo_caja
        `, [id]);
        res.json({ ...c.rows[0], identificador: etiqueta(c.rows[0]), cajas: cajas.rows });
    } catch (err) {
        console.error('Error al obtener ciclo:', err);
        res.status(500).json({ error: 'Error al obtener ciclo' });
    }
};

const crearCiclo = async (req, res) => {
    const numero_maquina = Number(req.body.numero_maquina);
    const numero_ciclo = Number(req.body.numero_ciclo);
    const { metodo, temperatura, presion, tiempo_minutos } = req.body;
    const codigos = [...new Set((Array.isArray(req.body.cajas) ? req.body.cajas : [])
        .map(c => String(c || '').trim().toUpperCase()).filter(Boolean))];

    if (!Number.isInteger(numero_maquina) || numero_maquina <= 0 || !Number.isInteger(numero_ciclo) || numero_ciclo <= 0) {
        return res.status(400).json({ error: 'Se requiere N° de máquina y N° de ciclo (enteros positivos).' });
    }
    if (codigos.length === 0) {
        return res.status(400).json({ error: 'La carga debe incluir al menos una caja.' });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const cajas = await client.query(
            'SELECT id, inventario_id, codigo_caja FROM caja_fisica WHERE codigo_caja = ANY($1::text[])', [codigos]);
        const encontradas = new Set(cajas.rows.map(r => r.codigo_caja));
        const faltantes = codigos.filter(c => !encontradas.has(c));
        if (faltantes.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: `Cajas no encontradas: ${faltantes.join(', ')}` });
        }

        const ciclo = await client.query(`
            INSERT INTO ciclo_esterilizacion
              (operador_id, maquina_autoclave, numero_maquina, numero_ciclo, metodo, temperatura, presion, tiempo_minutos, fecha_inicio, estado)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'En proceso') RETURNING *
        `, [req.user.id, `Autoclave ${numero_maquina}`, numero_maquina, numero_ciclo, metodo || 'Autoclave',
            temperatura === undefined || temperatura === '' ? null : temperatura, presion || null,
            tiempo_minutos === undefined || tiempo_minutos === '' ? null : tiempo_minutos]);
        const c = ciclo.rows[0];

        for (const caja of cajas.rows) {
            await client.query(
                `INSERT INTO vinculo_trazabilidad (ciclo_id, inventario_id, caja_fisica_id, cantidad_procesada, resultado, fecha)
                 VALUES ($1, $2, $3, 1, 'Pendiente', NOW())`, [c.id, caja.inventario_id, caja.id]);
            await client.query(
                `INSERT INTO historial_movimiento (inventario_id, caja_fisica_id, estado_nuevo, fecha_cambio, justificacion,
                   metodo_esterilizacion, temperatura, presion, tiempo_minutos, usuario_id)
                 VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9)`,
                [caja.inventario_id, caja.id, ESTERILIZACION_STAGE, `Carga ${etiqueta(c)} en autoclave`,
                 c.metodo, c.temperatura, c.presion, c.tiempo_minutos, req.user.id]);
        }

        await client.query('COMMIT');
        await registrarAuditoria(req, 'crear_ciclo', 'ciclo_esterilizacion', c.id, { carga: etiqueta(c), cajas: codigos });
        res.status(201).json({ ...c, identificador: etiqueta(c), cajas: codigos });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        if (err.code === '23505') {
            return res.status(409).json({ error: `Ya existe la carga M${numero_maquina}-C${numero_ciclo}.` });
        }
        console.error('Error al crear ciclo:', err);
        res.status(500).json({ error: 'Error al registrar la carga' });
    } finally {
        client.release();
    }
};

const registrarResultado = async (req, res) => {
    const id = Number(req.params.id);
    const resultado = String(req.body.resultado || '').trim();
    const observacion = String(req.body.observacion || '').trim();

    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id de ciclo inválido' });
    if (!RESULTADOS.includes(resultado)) {
        return res.status(400).json({ error: `resultado debe ser uno de: ${RESULTADOS.join(', ')}` });
    }
    // Protocolo de la Central: una carga no estéril no se libera y su causa queda escrita.
    if (resultado === 'No estéril' && !observacion) {
        return res.status(400).json({ error: 'Una carga No estéril requiere observación (causa: corte de luz, agua, indicador, etc.).' });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const upd = await client.query(`
            UPDATE ciclo_esterilizacion
            SET estado = $1, fecha_fin = NOW(), liberado_por = $2, observacion = NULLIF($3, '')
            WHERE id = $4 AND estado = 'En proceso'
            RETURNING *
        `, [resultado, req.user.id, observacion, id]);

        if (upd.rowCount === 0) {
            await client.query('ROLLBACK');
            const existe = await db.query('SELECT estado FROM ciclo_esterilizacion WHERE id = $1', [id]);
            if (existe.rows.length === 0) return res.status(404).json({ error: 'Ciclo no encontrado' });
            return res.status(409).json({ error: `El ciclo ya tiene resultado: ${existe.rows[0].estado}.` });
        }
        const c = upd.rows[0];

        const cajas = await client.query(
            `UPDATE vinculo_trazabilidad SET resultado = $1 WHERE ciclo_id = $2 RETURNING caja_fisica_id, inventario_id`,
            [resultado, id]);

        if (resultado === 'No estéril') {
            // Reproceso: cada caja vuelve a Lavado; necesitará una carga nueva Estéril.
            for (const caja of cajas.rows) {
                await client.query(
                    `INSERT INTO historial_movimiento (inventario_id, caja_fisica_id, estado_anterior, estado_nuevo, fecha_cambio, justificacion, usuario_id)
                     VALUES ($1, $2, $3, $4, NOW(), $5, $6)`,
                    [caja.inventario_id, caja.caja_fisica_id, ESTERILIZACION_STAGE, LAVADO_STAGE,
                     `Reproceso: carga ${etiqueta(c)} No estéril (${observacion})`.slice(0, 255), req.user.id]);
            }
        }

        await client.query('COMMIT');
        await registrarAuditoria(req, 'resultado_ciclo', 'ciclo_esterilizacion', id, { carga: etiqueta(c), resultado, observacion: observacion || null, cajas: cajas.rowCount });
        res.json({ ...c, identificador: etiqueta(c), cajas_afectadas: cajas.rowCount });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error al registrar resultado del ciclo:', err);
        res.status(500).json({ error: 'Error al registrar el resultado' });
    } finally {
        client.release();
    }
};

module.exports = { listarCiclos, detalleCiclo, crearCiclo, registrarResultado };
