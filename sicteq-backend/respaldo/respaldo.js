// PB-12: respaldo completo de la base (todas las tablas de public) a un archivo
// comprimido y, si existe BACKUP_PASSPHRASE, cifrado con AES-256-GCM (trae RUT
// y datos de pacientes: nunca subir un respaldo sin cifrar).
//
// Uso:  node respaldo/respaldo.js [carpeta_salida]        (por defecto ./respaldos)
// Lee DATABASE_URL del entorno o del .env. En GitHub Actions corre todos los días
// (.github/workflows/respaldo-diario.yml), con lo que se cumple el RPO de 24 h.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { clienteTexto, empaquetar, hashFilas, tablasEnOrden, leerTabla } = require('./comun');

async function main() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Falta DATABASE_URL.');
    const clave = process.env.BACKUP_PASSPHRASE || '';
    if (!clave && !process.argv.includes('--sin-cifrar')) {
        throw new Error('Falta BACKUP_PASSPHRASE (o use --sin-cifrar solo para pruebas locales).');
    }
    const salida = process.argv.slice(2).find(a => !a.startsWith('--')) || 'respaldos';

    const db = clienteTexto(url);
    await db.connect();
    const respaldo = { formato: 1, fecha: new Date().toISOString(), host: new URL(url).hostname.split('.')[0], orden: [], tablas: {} };
    try {
        // Una sola foto consistente de toda la base, aunque la app siga escribiendo.
        await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        respaldo.orden = await tablasEnOrden(db);
        for (const t of respaldo.orden) {
            const { columnas, filas } = await leerTabla(db, t);
            respaldo.tablas[t] = { columnas, filas, hash: hashFilas(filas) };
        }
        await db.query('COMMIT');
    } finally {
        await db.end();
    }

    fs.mkdirSync(salida, { recursive: true });
    const sello = respaldo.fecha.slice(0, 16).replace(/:/g, '-');
    const archivo = path.join(salida, `sicteq-${respaldo.host}-${sello}.json.gz${clave ? '.enc' : ''}`);
    fs.writeFileSync(archivo, empaquetar(respaldo, clave));

    const total = respaldo.orden.reduce((s, t) => s + respaldo.tablas[t].filas.length, 0);
    respaldo.orden.forEach(t => console.log(`  ${t.padEnd(24)} ${String(respaldo.tablas[t].filas.length).padStart(6)} filas  ${respaldo.tablas[t].hash}`));
    console.log(`Respaldo OK: ${archivo} (${respaldo.orden.length} tablas, ${total} filas, ${(fs.statSync(archivo).size / 1024).toFixed(0)} KB, ${clave ? 'cifrado' : 'SIN cifrar'})`);
}

main().catch(e => { console.error('Respaldo FALLÓ:', e.message); process.exit(1); });
