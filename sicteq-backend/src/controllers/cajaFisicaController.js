const db = require('../config/db');

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

module.exports = { getCajasEnCirculacion, getPacientesDeCaja };
