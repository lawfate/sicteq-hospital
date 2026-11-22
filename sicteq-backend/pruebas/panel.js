// Prioridad real de la cola del Panel. Datos temporales, revertidos al terminar.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const config = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '..', '.env.pruebas')));
if (!process.argv.includes('--confirmo-base-de-pruebas') || !new URL(config.DATABASE_URL).hostname.startsWith('ep-odd-art')) {
    throw new Error('Solo se permite la rama de pruebas con --confirmo-base-de-pruebas.');
}
process.env.DATABASE_URL = config.DATABASE_URL;
const db = require('../src/config/db');
const { getDashboardData } = require('../src/controllers/dashboardController');

(async () => {
    const cliente = await db.connect();
    const consultar = db.query;
    try {
        await cliente.query('BEGIN');
        await cliente.query("UPDATE solicitud SET estado = 'Despachado' WHERE estado IN ('Pendiente', 'En Preparación', 'Listo')");
        const area = (await cliente.query('SELECT id FROM area ORDER BY id LIMIT 1')).rows[0].id;
        const crear = async (tipo, estado = 'Pendiente') => (await cliente.query(
            'INSERT INTO solicitud (area_id, tipo_cirugia, estado) VALUES ($1, $2, $3) RETURNING id', [area, tipo, estado]
        )).rows[0].id;
        const programadas = [];
        for (let i = 0; i < 6; i++) programadas.push(await crear('Programada'));
        const urgencias = [await crear('Urgencia'), await crear('Urgente', 'Listo')];
        await crear('Urgencia', 'Despachado');
        // Todas las consultas del controlador ven la misma transacción sin confirmar.
        let cola = Promise.resolve();
        db.query = (...args) => {
            const siguiente = cola.then(() => cliente.query(...args));
            cola = siguiente.catch(() => {});
            return siguiente;
        };
        let respuesta;
        await getDashboardData({}, { json: (datos) => { respuesta = datos; }, status: () => { throw new Error('Falló el controlador'); } });
        assert.deepEqual(respuesta.criticas.map((s) => s.solicitud_id), [...urgencias, ...programadas.slice(0, 3)]);
        assert.equal(Number(respuesta.stats.solicitudes_urgentes), 2);
        assert.equal(Number(respuesta.stats.solicitudes_pendientes), 8);
        console.log('OK: urgencias primero, antigüedad, límite de cinco, exclusión de despachados y totales del Panel.');
    } finally {
        db.query = consultar;
        await cliente.query('ROLLBACK');
        cliente.release();
        await db.end();
    }
})().catch((err) => { console.error(err.message); process.exitCode = 1; });
