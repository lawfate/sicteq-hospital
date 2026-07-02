const db = require('../config/db');

const getDashboardMetrics = async (req, res) => {
    try {
        // Ejecutamos una sola consulta que agrupa todo
        const query = `
            SELECT 
                (SELECT COUNT(*) FROM CICLO_ESTERILIZACION WHERE estado = 'En Proceso') as en_proceso,
                (SELECT COUNT(*) FROM INVENTARIO WHERE cantidad_disponible < 5) as alertas_stock,
                (SELECT COUNT(*) FROM SOLICITUD WHERE estado = 'Pendiente') as solicitudes_pendientes,
                (SELECT COUNT(*) FROM INVENTARIO) as total_equipos
        `;
        
        const result = await db.query(query);
        res.json(result.rows[0]); // Devolvemos el objeto con los 4 números
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener métricas' });
    }
};

module.exports = { getDashboardMetrics };