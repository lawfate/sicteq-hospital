const db = require('../config/db');

const buscarFolio = async (req, res) => {
    const id = parseInt(req.params.id.replace(/\D/g, '')); 
    
    try {
        const invResult = await db.query(
            "SELECT inventario_id FROM HISTORIAL_MOVIMIENTO WHERE id = $1 LIMIT 1", 
            [id]
        );
        
        if (invResult.rows.length === 0) {
            return res.status(404).json({ message: "Folio no encontrado" });
        }
        
        const inventario_id = invResult.rows[0].inventario_id;

        // PROTECCIÓN 1: Si el registro huérfano no tiene equipo (es nulo en la BD)
        if (inventario_id === null || inventario_id === undefined) {
            console.log(`⚠️ ALERTA: El folio ${id} tiene inventario_id = NULL.`);
            // Devolvemos solo ese registro suelto para que el frontend no explote
            const fallbackResult = await db.query(`
                SELECT h.*, a.nombre AS destino_nombre 
                FROM HISTORIAL_MOVIMIENTO h
                LEFT JOIN AREA a ON h.area_destino_id = a.id
                WHERE h.id = $1
            `, [id]);
            return res.json(fallbackResult.rows);
        }

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
    const { id, stage, reason } = req.body; 
    
    try {
        const findInventarioId = await db.query(
            "SELECT inventario_id FROM HISTORIAL_MOVIMIENTO WHERE id = $1 LIMIT 1",
            [id]
        );

        if (findInventarioId.rows.length === 0) {
            return res.status(404).json({ error: "No se encontró el folio." });
        }

        const inventario_id = findInventarioId.rows[0].inventario_id;

        // PROTECCIÓN 2: No dejar procesar acciones a cajas "fantasma"
        if (inventario_id === null || inventario_id === undefined) {
            return res.status(400).json({ error: "Este folio no tiene un equipo asignado en la BD (inventario nulo). Actualice la BD." });
        }

        const query = `
            INSERT INTO HISTORIAL_MOVIMIENTO (inventario_id, estado_nuevo, fecha_cambio, area_destino_id, justificacion)
            VALUES ($1, $2, NOW(), $3, $4)
        `;
        
        const justificacionFinal = reason && reason.trim() !== "" ? reason : `Avance a Etapa ${stage}`;
        const values = [inventario_id, `Etapa ${stage}`, stage, justificacionFinal];
        
        await db.query(query, values);

        res.json({ success: true, message: "Etapa actualizada correctamente" });
    } catch (err) {
        console.error(">>> [ERROR CRÍTICO] FALLO EN SQL:", err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { 
    buscarFolio, 
    actualizarEtapa 
};