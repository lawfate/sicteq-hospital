// Tanda 3: cuentas con clave temporal, catálogo de cajas, estantes, conteo de
// piezas e incidencias, probados contra la API.
//
// ESCRIBE DATOS: solo contra la rama de pruebas de Neon, con el backend local
// apuntando a ella. Después conviene recargar el mock (seed_mock.js).
//
// Uso:  node pruebas/tanda3.js --confirmo-base-de-pruebas
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

// RUT válido y único para la cuenta de prueba (dígito verificador módulo 11).
const dv = (n) => { let s = 0, m = 2; for (const d of String(n).split('').reverse()) { s += Number(d) * m; m = m === 7 ? 2 : m + 1; } const r = 11 - (s % 11); return r === 11 ? '0' : r === 10 ? 'K' : String(r); };

(async () => {
    const it = (await entrar('33333333-3', '123456')).token;
    const enf = (await entrar('11111111-1', '123456')).token;
    const tens = (await entrar('22222222-2', '123456')).token;

    // ---- Cuentas: IT crea, clave temporal, cambio obligatorio ----
    const num = 20000000 + (Date.now() % 9000000);
    const rut = `${num}-${dv(num)}`;
    const roles = (await api('GET', '/api/usuarios/roles', it)).json;
    const rolTens = roles.find((x) => x.nombre === 'TENS').id;
    let r = await api('POST', '/api/usuarios', it, { rut: `${String(num).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv(num)}`, nombre: 'TENS Prueba Tanda3', rol_id: rolTens });
    ver('IT crea cuenta con RUT con puntos (se guarda normalizado)', r.status === 201 && r.json.rut === rut && r.json.clave_temporal?.length === 10, `${r.status} ${r.json.rut}`);
    const temporal = r.json.clave_temporal;
    const id = r.json.id;
    r = await api('POST', '/api/usuarios', it, { rut, nombre: 'Duplicado', rol_id: rolTens });
    ver('RUT duplicado se rechaza', r.status === 409, String(r.status));
    r = await api('POST', '/api/usuarios', it, { rut: `${num}-${dv(num) === '0' ? '1' : '0'}`, nombre: 'DV malo', rol_id: rolTens });
    ver('RUT con dígito verificador malo se rechaza', r.status === 400, String(r.status));
    r = await api('GET', '/api/usuarios', tens);
    ver('TENS no administra cuentas', r.status === 403, String(r.status));
    r = await api('GET', '/api/usuarios', it);
    ver('La lista de cuentas no trae hashes', r.status === 200 && !JSON.stringify(r.json).includes('password'), `${r.json.length} cuentas`);

    let sesion = await entrar(rut, temporal);
    ver('Login con clave temporal avisa que debe cambiarla', sesion.user?.debe_cambiar_clave === true);
    r = await api('GET', '/api/dashboard', sesion.token);
    ver('Con clave temporal no se puede usar el sistema', r.status === 403 && r.json.motivo === 'cambiar_clave', String(r.status));
    r = await api('POST', '/api/auth/cambiar-clave', sesion.token, { actual: temporal, nueva: 'corta' });
    ver('Clave nueva de menos de 8 caracteres se rechaza', r.status === 400, String(r.status));
    r = await api('POST', '/api/auth/cambiar-clave', sesion.token, { actual: 'otra-cosa', nueva: 'ClaveNueva2026' });
    ver('Sin la clave actual correcta no se cambia', r.status === 400, String(r.status));
    r = await api('POST', '/api/auth/cambiar-clave', sesion.token, { actual: temporal, nueva: 'ClaveNueva2026' });
    ver('Cambio de clave correcto', r.status === 200, String(r.status));
    r = await api('GET', '/api/dashboard', sesion.token);
    ver('Después del cambio ya puede trabajar', r.status === 200, String(r.status));

    r = await api('POST', `/api/usuarios/${id}/resetear`, it);
    ver('IT resetea la clave (nueva temporal)', r.status === 200 && r.json.clave_temporal?.length === 10, String(r.status));
    r = await api('GET', '/api/dashboard', sesion.token);
    ver('El reseteo cierra la sesión abierta', r.status === 401, String(r.status));
    sesion = await entrar(rut, r.json?.clave_temporal || 'x');
    const reseteada = await entrar(rut, 'ClaveNueva2026');
    ver('La clave anterior deja de servir tras el reseteo', !reseteada.token);
    r = await api('PUT', `/api/usuarios/${id}/activo`, it, { activo: false });
    ver('IT desactiva la cuenta', r.status === 200, String(r.status));
    const itId = (await db.query(`SELECT id FROM usuario WHERE rut = '33333333-3'`)).rows[0].id;
    r = await api('PUT', `/api/usuarios/${itId}/activo`, it, { activo: false });
    ver('IT no puede desactivarse a sí mismo', r.status === 409, String(r.status));

    // ---- Catálogo ----
    const cod = `TST-${String(Date.now()).slice(-3)}`;
    r = await api('POST', '/api/inventario', tens, { codigo_barra: cod, nombre_equipo: 'Set de prueba', categoria_id: 1, piezas: 10, stock_critico: 1 });
    ver('TENS no edita el catálogo', r.status === 403, String(r.status));
    r = await api('POST', '/api/inventario', enf, { codigo_barra: cod.toLowerCase(), nombre_equipo: 'Set de prueba tanda 3', categoria_id: '1', piezas: '10', stock_critico: 1 });
    ver('Enfermería crea un tipo de caja', r.status === 200 || r.status === 201, `${r.status} ${msgDe(r)}`);
    const tipoId = r.json.id;
    r = await api('POST', '/api/inventario', enf, { codigo_barra: cod, nombre_equipo: 'Repetido', categoria_id: 1, piezas: 10, stock_critico: 1 });
    ver('Código de tipo repetido se rechaza', r.status === 409, String(r.status));
    r = await api('POST', '/api/cajas', enf, { inventario_id: tipoId });
    ver('Se agrega una caja física con código correlativo', (r.status === 200 || r.status === 201) && /^CAJA-\d{4,}$/.test(r.json.codigo_caja), `${r.status} ${r.json.codigo_caja}`);
    const nueva = r.json.codigo_caja;
    r = await api('GET', `/api/cajas/${nueva}`, tens);
    ver('La ficha de la caja trae tipo y piezas', r.status === 200 && r.json.piezas === 10, `${r.status} ${r.json.tipo}`);

    // ---- Conteo de piezas e incidencia (la caja nueva entra en Recepción: se pasa a Lavado y se vuelve a recibir) ----
    await api('POST', '/api/trazabilidad/actualizar', tens, { codigo: nueva, stage: 2 });
    r = await api('POST', '/api/trazabilidad/actualizar', tens, { codigo: nueva, stage: 1, reason: 'Prueba de recepción', piezasContadas: 8 });
    ver('Recepción con 8 de 10 piezas crea incidencia', r.status === 200 && r.json.incidencia === true, `${r.status} ${msgDe(r)}`);
    r = await api('POST', '/api/trazabilidad/actualizar', tens, { codigo: nueva, stage: 1, reason: 'x', piezasContadas: 'diez' });
    ver('Conteo no numérico se rechaza', r.status === 400, String(r.status));
    const alertas = (await api('GET', '/api/alertas', tens)).json;
    const inc = (alertas.incidencias || []).find((i) => i.codigo_caja === nueva);
    ver('La incidencia aparece en las alertas del Panel', !!inc, inc ? `${inc.piezas_contadas}/${inc.piezas_esperadas}` : 'no está');
    r = await api('PUT', `/api/incidencias/${inc?.id}/resolver`, tens, { resolucion: 'Se repusieron' });
    ver('TENS no resuelve incidencias', r.status === 403, String(r.status));
    r = await api('PUT', `/api/incidencias/${inc?.id}/resolver`, enf, { resolucion: 'Se repusieron 2 pinzas desde reserva' });
    ver('Enfermería resuelve la incidencia', r.status === 200, String(r.status));
    r = await api('PUT', `/api/incidencias/${inc?.id}/resolver`, enf, { resolucion: 'Otra vez' });
    ver('Una incidencia resuelta no se resuelve de nuevo', r.status === 409, String(r.status));

    // ---- Estantes ----
    const est = `EST-T${String(Date.now()).slice(-3)}`;
    r = await api('POST', '/api/estantes', enf, { codigo: est.toLowerCase(), descripcion: 'Estante de prueba' });
    ver('Enfermería crea un estante', r.status === 200 || r.status === 201, String(r.status));
    r = await api('PUT', `/api/cajas/${nueva}/estante`, tens, { estante: est });
    ver('Una caja fuera de Bodega estéril no se ubica en estante', r.status === 409, String(r.status));
    const enBodega = (await db.query(`SELECT cf.codigo_caja FROM caja_fisica cf WHERE cf.estado = 'En circulación'
        AND (SELECT estado_nuevo FROM historial_movimiento h WHERE h.caja_fisica_id = cf.id ORDER BY fecha_cambio DESC, id DESC LIMIT 1) = 'Etapa 5' LIMIT 1`)).rows[0].codigo_caja;
    r = await api('PUT', `/api/cajas/${enBodega}/estante`, tens, { estante: est });
    ver('TENS ubica una caja de bodega en el estante', r.status === 200 && r.json.estante === est, `${enBodega} -> ${r.json.estante}`);
    r = await api('GET', `/api/cajas/${enBodega}`, tens);
    ver('Buscar la caja dice en qué estante está', r.json.estante === est, r.json.estante);

    // ---- Baja ----
    r = await api('PUT', `/api/cajas/${nueva}/baja`, enf, { motivo: 'Prueba de baja' });
    ver('Enfermería da de baja una caja', r.status === 200, String(r.status));
    r = await api('PUT', `/api/cajas/${nueva}/baja`, enf, { motivo: 'Otra vez' });
    ver('Una caja de baja no se da de baja de nuevo', r.status === 409, String(r.status));

    console.log(`${total - fallas}/${total} aprobados`);
    process.exitCode = fallas ? 1 : 0;
    await db.end();
})().catch(async (e) => { console.error(e); process.exitCode = 1; await db.end(); });

function msgDe(r) { return typeof r.json === 'string' ? r.json.slice(0, 80) : (r.json.error || r.json.message || '').slice(0, 80); }
