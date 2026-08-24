const db = require('../config/db');

// Crea el vínculo real caja física <-> paciente (reemplaza el alert()
// que antes simulaba esta acción sin guardar nada).
const crearVinculo = async (req, res) => {
    const rut = String(req.body.rut || '').trim();
    const codigo_caja = String(req.body.codigo_caja || '').trim().toUpperCase();
    const usuario_id = req.body.usuario_id || null;

    if (!rut || !codigo_caja) {
        return res.status(400).json({ error: "Se requiere rut y codigo_caja" });
    }

    try {
        const pacienteRes = await db.query('SELECT id, nombre FROM paciente WHERE rut = $1 LIMIT 1', [rut]);
        if (pacienteRes.rows.length === 0) {
            return res.status(404).json({ error: `No se encontró ningún paciente con el RUT "${rut}"` });
        }

        const cajaRes = await db.query('SELECT id FROM caja_fisica WHERE codigo_caja = $1 LIMIT 1', [codigo_caja]);
        if (cajaRes.rows.length === 0) {
            return res.status(404).json({ error: `No se encontró ninguna caja con el código "${codigo_caja}"` });
        }

        const paciente_id = pacienteRes.rows[0].id;
        const caja_fisica_id = cajaRes.rows[0].id;

        await db.query(
            `INSERT INTO vinculo_caja_paciente (caja_fisica_id, paciente_id, usuario_id, fecha_vinculo)
             VALUES ($1, $2, $3, NOW())`,
            [caja_fisica_id, paciente_id, usuario_id]
        );

        res.json({
            success: true,
            message: `Caja "${codigo_caja}" vinculada a la ficha clínica de ${pacienteRes.rows[0].nombre}.`
        });
    } catch (err) {
        console.error("Error al crear vínculo caja-paciente:", err);
        res.status(500).json({ error: "Error al registrar el vínculo" });
    }
};

module.exports = { crearVinculo };
