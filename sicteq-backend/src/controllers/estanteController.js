const db = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoria');

const getEstantes = async (req, res) => {
    try {
        const result = await db.query(`SELECT e.codigo, e.descripcion, COUNT(cf.id)::int AS cajas
            FROM estante e LEFT JOIN caja_fisica cf ON cf.estante_id = e.id
            WHERE e.activo = true GROUP BY e.id ORDER BY e.codigo`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al cargar estantes' });
    }
};

const crearEstante = async (req, res) => {
    const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo.trim().toUpperCase() : '';
    const descripcion = req.body?.descripcion ?? null;
    if (!/^EST-[A-Z0-9]{1,6}$/.test(codigo)) return res.status(400).json({ error: 'Código inválido: use EST- seguido de 1 a 6 letras o números.' });
    if (descripcion !== null && (typeof descripcion !== 'string' || descripcion.length > 100)) return res.status(400).json({ error: 'La descripción debe tener hasta 100 caracteres.' });
    try {
        const result = await db.query('INSERT INTO estante (codigo, descripcion) VALUES ($1, $2) RETURNING id, codigo, descripcion', [codigo, descripcion]);
        await registrarAuditoria(req, 'crear_estante', 'estante', result.rows[0].id, { codigo, descripcion });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Ya existe ese código de estante.' });
        res.status(500).json({ error: 'Error al crear estante' });
    }
};

module.exports = { getEstantes, crearEstante };
