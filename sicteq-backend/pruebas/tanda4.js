// Tanda 4: hoja de vida de cajas y tiempos por etapa, probados contra la API.
//
// Solo contra la rama de pruebas de Neon, con el backend local apuntando a ella.
// El login escribe datos de sesión.
//
// Uso:  node pruebas/tanda4.js --confirmo-base-de-pruebas
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const HOST_PRUEBAS = 'ep-odd-art';
const API = process.env.API_URL || 'http://localhost:4000';
const URL_DB = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '..', '.env.pruebas'))).DATABASE_URL;
if (!process.argv.includes('--confirmo-base-de-pruebas') || !new URL(URL_DB).host.startsWith(HOST_PRUEBAS)) {
    console.error(`Escribe datos: solo corre contra la rama de pruebas (${HOST_PRUEBAS}) y con --confirmo-base-de-pruebas.`);
    process.exit(1);
}
const db = new Pool({ connectionString: URL_DB, ssl: { rejectUnauthorized: false } });

const api = async (metodo, ruta, token, body) => {
    const r = await fetch(API + ruta, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const texto = await r.text();
    let json; try { json = JSON.parse(texto); } catch { json = texto; }
    return { status: r.status, json };
};
const entrar = async (rut, password) => (await api('POST', '/api/auth/login', null, { rut, password })).json;
let fallas = 0, total = 0;
const ver = (nombre, ok, detalle = '') => { total++; if (!ok) fallas++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${detalle ? ` -> ${detalle}` : ''}`); };

(async () => {
    const it = (await entrar('33333333-3', '123456')).token;
    const enf = (await entrar('11111111-1', '123456')).token;
    const tens = (await entrar('22222222-2', '123456')).token;

    // ---- Hoja de vida ----
    const caja = (await db.query(`SELECT cf.codigo_caja FROM caja_fisica cf
        WHERE EXISTS (SELECT 1 FROM historial_movimiento h WHERE h.caja_fisica_id = cf.id)
        ORDER BY cf.id LIMIT 1`)).rows[0].codigo_caja;
    const ruta = `/api/cajas/${encodeURIComponent(caja)}/hoja-vida`;
    let r = await api('GET', ruta, it);
    ver('IT consulta la hoja de vida de una caja existente', r.status === 200 && r.json.caja?.codigo_caja === caja, String(r.status));
    const movimientos = r.json.movimientos;
    ver('Los movimientos están ordenados del más antiguo al más reciente', Array.isArray(movimientos) && movimientos.length > 0 && movimientos.every((m, i) =>
        Number.isFinite(Date.parse(m.fecha_cambio)) && (i === 0 || Date.parse(movimientos[i - 1].fecha_cambio) <= Date.parse(m.fecha_cambio))));
    ver('La hoja de vida trae cargas', Array.isArray(r.json.cargas));
    ver('El resumen trae contadores numéricos', ['ciclos_completos', 'esterilizaciones', 'reprocesos', 'incidencias'].every(k =>
        Number.isInteger(r.json.resumen?.[k]) && r.json.resumen[k] >= 0));
    r = await api('GET', `/api/cajas/${encodeURIComponent(` ${caja.toLowerCase()} `)}/hoja-vida`, it);
    ver('El código se normaliza con trim y mayúsculas', r.status === 200 && r.json.caja?.codigo_caja === caja, String(r.status));
    r = await api('GET', ruta, tens);
    ver('TENS consulta la hoja de vida sin la clave pacientes', r.status === 200 && !Object.prototype.hasOwnProperty.call(r.json, 'pacientes'), String(r.status));
    r = await api('GET', ruta, enf);
    ver('Enfermería recibe el array de pacientes', r.status === 200 && Array.isArray(r.json.pacientes), String(r.status));
    r = await api('GET', '/api/cajas/CAJA-INEXISTENTE-TANDA4/hoja-vida', it);
    ver('Caja inexistente devuelve 404', r.status === 404, String(r.status));

    // ---- Tiempos por etapa ----
    r = await api('GET', '/api/reportes/tiempos', enf);
    const lavado = Array.isArray(r.json) ? r.json.find(f => f.estado === 'Etapa 2') : undefined;
    ver('Enfermería consulta tiempos y Lavado tiene mediana numérica no negativa', r.status === 200 && Number.isFinite(lavado?.mediana_min) && lavado.mediana_min >= 0, String(r.status));
    r = await api('GET', '/api/reportes/tiempos', tens);
    ver('TENS no consulta tiempos por etapa', r.status === 403, String(r.status));
    r = await api('GET', '/api/reportes/tiempos?desde=no-es-fecha', enf);
    ver('Una fecha inválida devuelve 400', r.status === 400, String(r.status));

    console.log(`${total - fallas}/${total} aprobados`);
    process.exitCode = fallas ? 1 : 0;
    await db.end();
})().catch(async (e) => { console.error(e); process.exitCode = 1; await db.end(); });
