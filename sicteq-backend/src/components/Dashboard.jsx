const db = require('../config/db');

const getDashboardData = async (req, res) => {
    try {
        const stats = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM CICLO_ESTERILIZACION WHERE estado = 'En Proceso') as "Cajas en Proceso",
                (SELECT COUNT(*) FROM CICLO_ESTERILIZACION WHERE estado = 'Listo') as "Listas / Despachadas",
                (SELECT COUNT(*) FROM INVENTARIO WHERE estado_actual = 'Alerta') as "Alertas de Merma",
                (SELECT COUNT(*) FROM SOLICITUD WHERE estado = 'Pendiente') as "Solicitudes Pabellón"
        `);
        
        const moves = await db.query('SELECT * FROM HISTORIAL_MOVIMIENTO ORDER BY fecha_cambio DESC LIMIT 5');
        
        res.json({
            stats: stats.rows[0],
            movimientos: moves.rows,
            criticas: [] 
        });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
};

module.exports = { getDashboardData };