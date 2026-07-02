const db = require('../config/db');

const buscarFolio = async (req, res) => {
    const { id } = req.params; 
    try {
        const result = await db.query(`
            SELECT h.*, a.nombre AS destino_nombre 
            FROM HISTORIAL_MOVIMIENTO h
            LEFT JOIN AREA a ON h.area_destino_id = a.id
            WHERE h.inventario_id = $1
            ORDER BY h.fecha_cambio DESC
            LIMIT 1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Folio no encontrado" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Error al buscar folio:", err);
        res.status(500).json({ error: err.message });
    }
};

const actualizarEtapa = async (req, res) => {
    // ESTO SALDRÁ PRIMERO: confirma si la petición llegó
    console.log(">>> [DEBUG] Petición recibida en actualizarEtapa");
    console.log(">>> [DEBUG] Body completo:", req.body);

    const { id, stage } = req.body; 
    
    try {
        const query = `
            INSERT INTO HISTORIAL_MOVIMIENTO (inventario_id, estado_nuevo, fecha_cambio, area_destino_id)
            VALUES ($1, $2, NOW(), $3)
        `;
        const values = [id, `Etapa ${stage}`, stage];
        
        console.log(">>> [DEBUG] Ejecutando Query:", query);
        console.log(">>> [DEBUG] Valores:", values);

        await db.query(query, values);

        res.json({ success: true, message: "Etapa actualizada correctamente" });
    } catch (err) {
        // ESTO SALDRÁ SI FALLA EL SQL
        console.error(">>> [ERROR CRÍTICO] FALLO EN SQL:");
        console.error("Mensaje:", err.message);
        console.error("Detalle:", err.detail || "Sin detalle adicional");
        
        res.status(500).json({ 
            error: err.message, 
            msg: "Revisa la consola del servidor para ver el error SQL exacto" 
        });
    }
};

module.exports = { 
    buscarFolio, 
    actualizarEtapa 
};