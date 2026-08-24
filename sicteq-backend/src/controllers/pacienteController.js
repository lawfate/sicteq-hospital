const db = require('../config/db');

// Lista de pacientes con la cantidad de cajas que tienen vinculadas
// (dirección paciente -> cajas).
const getPacientes = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                p.id, p.rut, p.nombre, p.edad, p.diagnostico, p.alertas_iaas,
                a.nombre AS area_nombre,
                COUNT(v.id) AS cajas_vinculadas
            FROM paciente p
            LEFT JOIN area a ON p.area_id = a.id
            LEFT JOIN vinculo_caja_paciente v ON v.paciente_id = p.id
            GROUP BY p.id, a.nombre
            ORDER BY p.nombre ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener pacientes:", err);
        res.status(500).json({ error: "Error al obtener pacientes" });
    }
};

// Ficha de un paciente + su historial completo de cajas vinculadas
// (misma dirección paciente -> cajas, con detalle).
const getPacienteDetalle = async (req, res) => {
    const rut = String(req.params.rut || '').trim();

    if (!rut) {
        return res.status(400).json({ error: "RUT inválido" });
    }

    try {
        const pacienteRes = await db.query(`
            SELECT p.id, p.rut, p.nombre, p.edad, p.diagnostico, p.alertas_iaas, a.nombre AS area_nombre
            FROM paciente p
            LEFT JOIN area a ON p.area_id = a.id
            WHERE p.rut = $1
            LIMIT 1
        `, [rut]);

        if (pacienteRes.rows.length === 0) {
            return res.status(404).json({ error: `No se encontró ningún paciente con el RUT "${rut}"` });
        }

        const paciente = pacienteRes.rows[0];

        const historial = await db.query(`
            SELECT v.id, v.fecha_vinculo, cf.codigo_caja, i.nombre_equipo, u.nombre AS vinculado_por
            FROM vinculo_caja_paciente v
            JOIN caja_fisica cf ON v.caja_fisica_id = cf.id
            JOIN inventario i ON cf.inventario_id = i.id
            LEFT JOIN usuario u ON v.usuario_id = u.id
            WHERE v.paciente_id = $1
            ORDER BY v.fecha_vinculo DESC
        `, [paciente.id]);

        res.json({ ...paciente, historial: historial.rows });
    } catch (err) {
        console.error("Error al obtener ficha del paciente:", err);
        res.status(500).json({ error: "Error al obtener ficha del paciente" });
    }
};

module.exports = { getPacientes, getPacienteDetalle };
