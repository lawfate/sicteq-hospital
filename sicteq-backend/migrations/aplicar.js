// Aplica todas las migraciones de esta carpeta, en orden de nombre, en una sola
// transacción. Son idempotentes (IF NOT EXISTS): correrlas dos veces no hace daño.
// No hace falta psql.
//
// Uso:  node migrations/aplicar.js            (usa DATABASE_URL del entorno o del .env)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Falta DATABASE_URL.');
    const archivos = fs.readdirSync(__dirname).filter(f => f.endsWith('.sql')).sort();
    const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await db.connect();
    console.log(`Base: ${new URL(url).hostname.split('.')[0]}`);
    try {
        await db.query('BEGIN');
        for (const f of archivos) {
            await db.query(fs.readFileSync(path.join(__dirname, f), 'utf8'));
            console.log(`  aplicada ${f}`);
        }
        await db.query('COMMIT');
        console.log(`OK: ${archivos.length} migraciones aplicadas.`);
    } catch (e) {
        await db.query('ROLLBACK').catch(() => {});
        throw e;
    } finally {
        await db.end();
    }
})().catch(e => { console.error('Migración FALLÓ (no se cambió nada):', e.message); process.exit(1); });
