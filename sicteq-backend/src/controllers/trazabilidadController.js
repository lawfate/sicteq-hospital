const db = require('../config/db');

const buscarFolio = async (req, res) => {
    // Limpiamos el ID para asegurar que solo contenga números
    const id = parseInt(req.params.id.replace(/\D/g, ''), 10); 
    
    try {
        const invResult = await db.query(
            "SELECT inventario_id FROM HISTORIAL_MOVIMIENTO WHERE id = $1 LIMIT 1", 
            [id]
        );
        
        if (invResult.rows.length === 0) {
            return res.status(404).json({ message: "Folio no encontrado" });
        }
        
        const inventario_id = invResult.rows[0].inventario_id;

        // Si el registro existe pero no tiene equipo (nulo), devolvemos el registro solo
        if (inventario_id === null || inventario_id === undefined) {
            const fallbackResult = await db.query(`
                SELECT h.*, a.nombre AS destino_nombre 
                FROM HISTORIAL_MOVIMIENTO h
                LEFT JOIN AREA a ON h.area_destino_id = a.id
                WHERE h.id = $1
            `, [id]);
            return res.json(fallbackResult.rows);
        }

        // Si tiene inventario_id, buscamos todo el historial relacionado
        const result = await db.query(`
            SELECT h.*, a.nombre AS destino_nombre 
            FROM HISTORIAL_MOVIMIENTO h
            LEFT JOIN AREA a ON h.area_destino_id = a.id
            WHERE h.inventario_id = $1
            ORDER BY h.fecha_cambio DESC
        `, [inventario_id]);

        res.json(result.rows); 
    } catch (err) {
        console.error("Error al buscar folio:", err);
        res.status(500).json({ error: err.message });
    }
};

const actualizarEtapa = async (req, res) => {
    // Limpiamos el ID que viene del cuerpo de la petición
    const id = parseInt(String(req.body.id).replace(/\D/g, ''), 10);
    const { stage, reason } = req.body; 
    
    // Validación de campos requeridos
    if (!id || stage === undefined || !reason) {
        return res.status(400).json({ error: "Datos incompletos: se requiere id, stage y reason." });
    }

    try {
        const findInventarioId = await db.query(
            "SELECT inventario_id, area_destino_id FROM HISTORIAL_MOVIMIENTO WHERE id = $1 LIMIT 1",
            [id]
        );

        if (findInventarioId.rows.length === 0) {
            return res.status(404).json({ error: "No se encontró el folio." });
        }

        const { inventario_id, area_destino_id } = findInventarioId.rows[0];

        if (inventario_id === null) {
            return res.status(400).json({ error: "Este folio no tiene un equipo asignado." });
        }

        // Formatear el estado y la justificación
        const estadoFormateado = typeof stage === 'string' ? stage : `Etapa ${stage}`;
        const justificacionFinal = reason.trim() !== "" ? reason : `Avance a ${estadoFormateado}`;
        
        const query = `
            INSERT INTO HISTORIAL_MOVIMIENTO 
            (inventario_id, estado_nuevo, fecha_cambio, area_destino_id, justificacion)
            VALUES ($1, $2, NOW(), $3, $4)
        `;
        
        const values = [inventario_id, estadoFormateado, area_destino_id, justificacionFinal];
        
        await db.query(query, values);

        res.json({ success: true, message: "Etapa actualizada correctamente" });
    } catch (err) {
        console.error(">>> [ERROR CRÍTICO] FALLO EN SQL:", err);
        res.status(500).json({ error: "Error al insertar en la base de datos: " + err.message });
    }
};

module.exports = { 
    buscarFolio, 
    actualizarEtapa 
};