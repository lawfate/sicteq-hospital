const pool = require('../config/db');

// Asegúrate de que buscarFolio esté definida aquí
const buscarFolio = async (req, res) => {
    try {
        const { id } = req.params;
        const query = 'SELECT * FROM solicitud WHERE id = $1';
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: "Solicitud no encontrada" });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error al buscar folio:", error);
        res.status(500).json({ mensaje: "Error interno al buscar la solicitud" });
    }
};

const actualizarEtapa = async (req, res) => {
    const { id, stage, reason } = req.body;

    // Validación básica de campos requeridos
    if (!id || !stage || !reason) {
        return res.status(400).json({ mensaje: "Faltan datos requeridos (id, stage, reason)" });
    }

    try {
        // 1. Actualizar el estado en la tabla 'solicitud'
        const querySolicitud = 'UPDATE solicitud SET estado = $1 WHERE id = $2';
        await pool.query(querySolicitud, [stage, id]);

        // 2. Insertar el movimiento en 'historial_movimiento'
        const queryHistorial = `
            INSERT INTO historial_movimiento (solicitud_id, estado_nuevo, justificacion, fecha_cambio) 
            VALUES ($1, $2, $3, NOW())
        `;
        await pool.query(queryHistorial, [id, stage, reason]);

        res.status(200).json({ mensaje: "Etapa actualizada y registrada en historial correctamente" });
    } catch (error) {
        console.error("Error al actualizar:", error);
        res.status(500).json({ mensaje: "Error interno al actualizar la etapa" });
    }
};

module.exports = { buscarFolio, actualizarEtapa };