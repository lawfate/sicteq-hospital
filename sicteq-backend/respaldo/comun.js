// PB-12: utilidades compartidas por respaldo.js y restaurar.js.
const crypto = require('crypto');
const zlib = require('zlib');
const { Client } = require('pg');

// Todos los valores como texto tal cual los entrega Postgres: así el respaldo
// no pierde microsegundos, decimales ni zonas al pasar por tipos de JavaScript.
const clienteTexto = (url) => new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    types: { getTypeParser: () => (v) => v },
});

const MAGIA = Buffer.from('SICTEQ1'); // cabecera de los respaldos cifrados

function cifrar(datos, clave) {
    const sal = crypto.randomBytes(16), iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', crypto.scryptSync(clave, sal, 32), iv);
    const cuerpo = Buffer.concat([c.update(datos), c.final()]);
    return Buffer.concat([MAGIA, sal, iv, c.getAuthTag(), cuerpo]);
}

function descifrar(buf, clave) {
    if (!buf.subarray(0, MAGIA.length).equals(MAGIA)) return buf; // no estaba cifrado
    if (!clave) throw new Error('El respaldo está cifrado: falta BACKUP_PASSPHRASE.');
    let o = MAGIA.length;
    const sal = buf.subarray(o, o += 16), iv = buf.subarray(o, o += 12), tag = buf.subarray(o, o += 16);
    const d = crypto.createDecipheriv('aes-256-gcm', crypto.scryptSync(clave, sal, 32), iv);
    d.setAuthTag(tag);
    try {
        return Buffer.concat([d.update(buf.subarray(o)), d.final()]);
    } catch {
        throw new Error('No se pudo descifrar: BACKUP_PASSPHRASE incorrecta o archivo alterado.');
    }
}

const empaquetar = (obj, clave) => {
    const gz = zlib.gzipSync(JSON.stringify(obj));
    return clave ? cifrar(gz, clave) : gz;
};
const desempaquetar = (buf, clave) => JSON.parse(zlib.gunzipSync(descifrar(buf, clave)).toString('utf8'));

const hashFilas = (filas) => crypto.createHash('sha256').update(JSON.stringify(filas)).digest('hex').slice(0, 16);

// Tablas de public ordenadas para insertar padres antes que hijos (llaves foráneas).
async function tablasEnOrden(db) {
    const { rows: tablas } = await db.query(`SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`);
    const { rows: fks } = await db.query(`SELECT c.conrelid::regclass::text AS hija, c.confrelid::regclass::text AS padre
        FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE c.contype = 'f' AND n.nspname = 'public'`);
    const pendientes = new Set(tablas.map(t => t.table_name));
    const orden = [];
    while (pendientes.size) {
        const listas = [...pendientes].filter(t => !fks.some(f => f.hija === t && f.padre !== t && pendientes.has(f.padre)));
        if (!listas.length) throw new Error('Ciclo de llaves foráneas entre: ' + [...pendientes].join(', '));
        listas.forEach(t => { orden.push(t); pendientes.delete(t); });
    }
    return orden;
}

// Lectura estable de una tabla: mismo orden siempre, para que el hash sea comparable.
// shortcut: ordena por la 1a columna (en SICTEQ siempre es el id SERIAL); si una tabla
// nueva no empieza por una columna única, la verificación del hash lo va a delatar.
// Con `columnas` lee solo esas: un respaldo anterior a una migración se puede
// verificar en una base que ya tiene columnas nuevas.
async function leerTabla(db, tabla, columnas) {
    const cols = columnas ? columnas.map(c => `"${c}"`).join(', ') : '*';
    const r = await db.query(`SELECT ${cols} FROM "${tabla}" ORDER BY 1`);
    return { columnas: r.fields.map(f => f.name), filas: r.rows.map(row => r.fields.map(f => row[f.name])) };
}

module.exports = { clienteTexto, empaquetar, desempaquetar, hashFilas, tablasEnOrden, leerTabla };
