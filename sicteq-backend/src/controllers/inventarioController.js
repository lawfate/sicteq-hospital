const db = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoria');
const { entero } = require('../utils/validacion');

const getInventario = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, nombre_equipo, codigo_barra, cantidad_disponible, cantidad_total, estado_actual, stock_critico, piezas,
                   (SELECT COUNT(*)::int FROM caja_fisica cf WHERE cf.inventario_id = inventario.id AND cf.estado = 'En circulación') AS cajas
            FROM inventario
            ORDER BY nombre_equipo ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Error al cargar inventario" });
    }
};

const getCategorias = async (req, res) => {
    try {
        res.json((await db.query('SELECT id, nombre FROM categoria ORDER BY nombre')).rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al cargar categorías' });
    }
};

const guardarInventario = async (req, res) => {
    const id = req.params.id === undefined ? null : entero(req.params.id);
    const body = req.body || {};
    const codigo_barra = typeof body.codigo_barra === 'string' ? body.codigo_barra.trim().toUpperCase() : '';
    const nombre_equipo = typeof body.nombre_equipo === 'string' ? body.nombre_equipo.trim() : '';
    const categoria_id = entero(body.categoria_id);
    const piezas = entero(body.piezas, 1, 500);
    const stock_critico = entero(body.stock_critico, 0, 100);
    if (req.params.id !== undefined && id === null) return res.status(400).json({ error: 'Id de inventario inválido.' });
    if (!/^[A-Z]{3}-\d{3}$/.test(codigo_barra)) return res.status(400).json({ error: 'codigo_barra debe tener formato ABC-123.' });
    if (nombre_equipo.length < 3 || nombre_equipo.length > 100) return res.status(400).json({ error: 'El nombre debe tener entre 3 y 100 caracteres.' });
    if (categoria_id === null || piezas === null || stock_critico === null) return res.status(400).json({ error: 'Se requiere categoría válida, piezas entre 1 y 500 y stock_critico entre 0 y 100 (enteros).' });
    let client;
    try {
        client = await db.connect();
        await client.query('BEGIN');
        // Protege la unicidad también en el esquema sin índice UNIQUE.
        await client.query('LOCK TABLE inventario IN SHARE ROW EXCLUSIVE MODE');
        const categoria = await client.query('SELECT id FROM categoria WHERE id = $1', [categoria_id]);
        if (!categoria.rowCount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'La categoría indicada no existe.' });
        }
        const duplicado = await client.query('SELECT id FROM inventario WHERE codigo_barra = $1 AND ($2::int IS NULL OR id <> $2) LIMIT 1', [codigo_barra, id]);
        if (duplicado.rowCount) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Ya existe ese código de inventario.' });
        }
        const values = [codigo_barra, nombre_equipo, categoria_id, piezas, stock_critico];
        const result = id === null
            ? await client.query(`INSERT INTO inventario (codigo_barra, nombre_equipo, categoria_id, piezas, stock_critico,
                cantidad_total, cantidad_disponible, estado_actual) VALUES ($1, $2, $3, $4, $5, 0, 0, 'Disponible') RETURNING *`, values)
            : await client.query(`UPDATE inventario SET codigo_barra = $1, nombre_equipo = $2, categoria_id = $3,
                piezas = $4, stock_critico = $5 WHERE id = $6 RETURNING *`, [...values, id]);
        if (!result.rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Tipo de caja no encontrado' });
        }
        await client.query('COMMIT');
        await registrarAuditoria(req, id === null ? 'crear_inventario' : 'actualizar_inventario', 'inventario', result.rows[0].id,
            { codigo_barra, nombre_equipo, categoria_id, piezas, stock_critico });
        res.status(id === null ? 201 : 200).json(result.rows[0]);
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        if (err.code === '23505') return res.status(409).json({ error: 'Ya existe ese código de inventario.' });
        if (err.code === '23503') return res.status(400).json({ error: 'La categoría indicada no existe.' });
        res.status(500).json({ error: 'Error al guardar inventario' });
    } finally {
        if (client) client.release();
    }
};

module.exports = { getInventario, getCategorias, guardarInventario };
