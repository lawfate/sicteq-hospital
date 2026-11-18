// PB-12: restaura un respaldo de respaldo.js en una base DESTINO y verifica que
// cada tabla quede idéntica (mismo hash de contenido). Todo ocurre en una sola
// transacción: si algo falla, el destino queda como estaba.
//
// La base destino debe tener el esquema ya creado (schema.sql + migrations/).
// BORRA los datos actuales del destino.
//
// Uso:  RESTORE_DATABASE_URL=... node respaldo/restaurar.js <archivo> --confirmo-borrar-destino
//       (para restaurar en producción además hay que agregar --es-produccion)
require('dotenv').config();
const fs = require('fs');
const { clienteTexto, desempaquetar, hashFilas, leerTabla } = require('./comun');

const HOST_PRODUCCION = 'ep-lively-credit';

async function main() {
    const archivo = process.argv.slice(2).find(a => !a.startsWith('--'));
    const url = process.env.RESTORE_DATABASE_URL;
    if (!archivo || !url || !process.argv.includes('--confirmo-borrar-destino')) {
        throw new Error('Uso: RESTORE_DATABASE_URL=... node respaldo/restaurar.js <archivo> --confirmo-borrar-destino');
    }
    const host = new URL(url).hostname;
    if (host.startsWith(HOST_PRODUCCION) && !process.argv.includes('--es-produccion')) {
        throw new Error(`El destino es PRODUCCIÓN (${host}). Si de verdad hay que restaurar ahí, agregue --es-produccion.`);
    }

    const r = desempaquetar(fs.readFileSync(archivo), process.env.BACKUP_PASSPHRASE);
    console.log(`Restaurando respaldo del ${r.fecha} (origen ${r.host}) en ${host.split('.')[0]}...`);

    const db = clienteTexto(url);
    await db.connect();
    try {
        await db.query('BEGIN');
        await db.query(`TRUNCATE ${r.orden.map(t => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
        for (const t of r.orden) {
            const { columnas, filas } = r.tablas[t];
            const cols = columnas.map(c => `"${c}"`).join(', ');
            const porLote = Math.max(1, Math.floor(30000 / columnas.length)); // límite de 65535 parámetros
            for (let i = 0; i < filas.length; i += porLote) {
                const lote = filas.slice(i, i + porLote);
                const valores = lote.map((_, f) => `(${columnas.map((__, c) => `$${f * columnas.length + c + 1}`).join(', ')})`).join(', ');
                await db.query(`INSERT INTO "${t}" (${cols}) VALUES ${valores}`, lote.flat());
            }
            // Que los próximos INSERT de la app no choquen con los id restaurados.
            const { rows: seqs } = await db.query(`SELECT column_name, pg_get_serial_sequence($1, column_name) AS seq
                FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $2
                  AND pg_get_serial_sequence($1, column_name) IS NOT NULL`, [`public."${t}"`, t]);
            for (const s of seqs) {
                await db.query(`SELECT setval($1, COALESCE((SELECT MAX("${s.column_name}") FROM "${t}"), 1), (SELECT COUNT(*) > 0 FROM "${t}"))`, [s.seq]);
            }
        }
        // Verificación dentro de la misma transacción: si no calza, no se confirma nada.
        const malas = [];
        for (const t of r.orden) {
            const { filas } = await leerTabla(db, t, r.tablas[t].columnas);
            const ok = hashFilas(filas) === r.tablas[t].hash;
            console.log(`  ${t.padEnd(24)} ${String(filas.length).padStart(6)} filas  ${ok ? 'OK' : 'DIFERENTE'}`);
            if (!ok) malas.push(t);
        }
        if (malas.length) throw new Error('El contenido restaurado no coincide en: ' + malas.join(', '));
        await db.query('COMMIT');
        console.log(`Restauración OK y verificada: ${r.orden.length} tablas idénticas al respaldo.`);
    } catch (e) {
        await db.query('ROLLBACK').catch(() => {});
        throw e;
    } finally {
        await db.end();
    }
}

main().catch(e => { console.error('Restauración FALLÓ:', e.message); process.exit(1); });
