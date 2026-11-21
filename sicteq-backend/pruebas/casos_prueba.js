// PB-08: casos de prueba CP-01 a CP-14 del plan de pruebas del Informe 2
// (Tabla de casos), automatizados contra la API. Genera la evidencia en Markdown.
//
// ESCRIBE DATOS (cargas, movimientos, vínculos, despachos): solo contra la rama
// de pruebas de Neon, con el backend local apuntando a ella.
//
// Uso:  node pruebas/casos_prueba.js --confirmo-base-de-pruebas [salida.md]
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const HOST_PRUEBAS = 'ep-odd-art';
const API = process.env.API_URL || 'http://localhost:4000';
const PRODUCCION = 'https://sicteq-backend.onrender.com';
const URL_DB = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '..', '.env.pruebas'))).DATABASE_URL;
if (!process.argv.includes('--confirmo-base-de-pruebas') || !new URL(URL_DB).host.startsWith(HOST_PRUEBAS)) {
    console.error(`Escribe datos: solo corre contra la rama de pruebas (${HOST_PRUEBAS}) y con --confirmo-base-de-pruebas.`);
    process.exit(1);
}
const salida = process.argv.slice(2).find(a => a.endsWith('.md'));
const db = new Pool({ connectionString: URL_DB, ssl: { rejectUnauthorized: false } });
const USUARIOS = { enfermera: '11111111-1', tens: '22222222-2', it: '33333333-3' };
const resultados = [];

const api = async (metodo, ruta, token, body, base = API) => {
    const t0 = performance.now();
    const r = await fetch(base + ruta, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const texto = await r.text();
    let json; try { json = JSON.parse(texto); } catch { json = texto; }
    return { status: r.status, json, ms: Math.round(performance.now() - t0) };
};
const login = async (quien) => (await api('POST', '/api/auth/login', null, { rut: USUARIOS[quien], password: '123456' })).json.token;

const caso = (cp, req, nombre, esperado, obtenido, ok, detalle = '') => {
    resultados.push({ cp, req, nombre, esperado, obtenido, ok, detalle });
    console.log(`${ok ? 'OK   ' : 'FALLA'} ${cp} ${nombre} -> ${obtenido}`);
};
const msg = (j) => (typeof j === 'string' ? j : (j.error || j.message || JSON.stringify(j))).slice(0, 120);

(async () => {
    const inicio = new Date();

    // CP-01 login correcto
    let r = await api('POST', '/api/auth/login', null, { rut: USUARIOS.it, password: '123456' });
    caso('CP-01', 'RF-02 / RNF-01', 'Inicio de sesión con RUT y contraseña válidos', '200 y token JWT',
        `${r.status}, token ${r.json.token ? 'recibido' : 'NO'} (${r.ms} ms)`, r.status === 200 && !!r.json.token);
    const it = r.json.token;

    // CP-02 contraseña incorrecta (un solo intento: el bloqueo es a los 5)
    r = await api('POST', '/api/auth/login', null, { rut: USUARIOS.enfermera, password: 'incorrecta' });
    caso('CP-02', 'RNF-01', 'Contraseña incorrecta', '401 sin token', `${r.status}, token ${r.json.token ? 'SÍ' : 'no'}`,
        r.status === 401 && !r.json.token, msg(r.json));

    const enf = await login('enfermera'); // también reinicia el contador de intentos
    const tens = await login('tens');

    // CP-03 sin token
    r = await api('GET', '/api/dashboard');
    caso('CP-03', 'RNF-01', 'Petición a /api/dashboard sin token', '401 "No autenticado"', `${r.status} ${msg(r.json)}`,
        r.status === 401 && /No autenticado/.test(msg(r.json)));

    // CP-04 token alterado y token vencido (firmado con la clave real, pero expirado)
    const alterado = it.slice(0, -3) + (it.slice(-3) === 'aaa' ? 'bbb' : 'aaa');
    r = await api('GET', '/api/dashboard', alterado);
    const r2 = await api('GET', '/api/dashboard', jwt.sign({ ...jwt.decode(it), exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET));
    caso('CP-04', 'RNF-01', 'Token alterado o vencido', '401 "Sesión inválida o expirada"', `alterado ${r.status}, vencido ${r2.status}`,
        r.status === 401 && r2.status === 401 && /inválida o expirada/.test(msg(r2.json)), msg(r2.json));

    // CP-05 caja inexistente
    r = await api('GET', '/api/trazabilidad/buscar/CAJA-9999', tens);
    caso('CP-05', 'RF-02', 'Buscar un código de caja inexistente', '404 con mensaje claro', `${r.status} ${msg(r.json)}`, r.status === 404);

    // CP-06 datos incompletos y etapa inválida
    r = await api('POST', '/api/trazabilidad/actualizar', tens, { stage: 2 });
    const r6 = await api('POST', '/api/trazabilidad/actualizar', tens, { codigo: 'CAJA-0001', stage: 99 });
    caso('CP-06', 'RF-02', 'Actualizar etapa sin código, o con etapa fuera de 1-6', '400 "Datos incompletos" / 400 etapa inválida',
        `sin código ${r.status}, etapa 99 ${r6.status}`, r.status === 400 && r6.status === 400, msg(r6.json));

    // CP-07 / CP-08: carga Estéril y paso a Almacenamiento con los 4 parámetros
    const caja = (await db.query(`SELECT cf.id, cf.codigo_caja, cf.inventario_id FROM caja_fisica cf
        WHERE cf.estado = 'En circulación' ORDER BY random() LIMIT 1`)).rows[0];
    const numCiclo = 900000 + Number(String(Date.now()).slice(-5));
    await api('POST', '/api/trazabilidad/actualizar', tens, { codigo: caja.codigo_caja, stage: 3, reason: 'CP-07: caja preparada para la carga' });
    r = await api('POST', '/api/ciclos', tens, { numero_maquina: 3, numero_ciclo: numCiclo, metodo: 'Autoclave', temperatura: 134, presion: '2.1 bar', tiempo_minutos: 18, cajas: [caja.codigo_caja] });
    const ciclo = r.json.id;
    await api('PUT', `/api/ciclos/${ciclo}/resultado`, enf, { resultado: 'Estéril' });
    r = await api('POST', '/api/trazabilidad/actualizar', tens, { codigo: caja.codigo_caja, stage: 5, metodo: 'Autoclave', temperatura: 134, presion: '2.1 bar', tiempoMinutos: 18 });
    const mov = (await db.query(`SELECT metodo_esterilizacion, temperatura, presion, tiempo_minutos FROM historial_movimiento
        WHERE caja_fisica_id = $1 ORDER BY fecha_cambio DESC, id DESC LIMIT 1`, [caja.id])).rows[0];
    caso('CP-07', 'RF-02', `Registrar esterilización con método, temperatura, presión y tiempo (${caja.codigo_caja}, carga M3-C${numCiclo})`,
        'Movimiento guardado con los cuatro parámetros', `${r.status}: ${mov.metodo_esterilizacion} · ${mov.temperatura}°C · ${mov.presion} · ${mov.tiempo_minutos} min`,
        r.status === 200 && mov.metodo_esterilizacion === 'Autoclave' && Number(mov.temperatura) === 134 && mov.presion === '2.1 bar' && Number(mov.tiempo_minutos) === 18);
    const cad = (await db.query(`SELECT ROUND(EXTRACT(EPOCH FROM (fecha_caducidad - NOW())) / 86400)::int AS dias FROM caja_fisica WHERE id = $1`, [caja.id])).rows[0];
    caso('CP-08', 'RF-04', 'Registrar Almacenamiento con vigencia por defecto', 'fecha_caducidad = hoy + 365 días', `hoy + ${cad.dias} días`, cad.dias === 365);

    // CP-09 vínculo caja-paciente
    const pac = (await db.query('SELECT rut FROM paciente ORDER BY id LIMIT 1')).rows[0];
    r = await api('POST', '/api/vinculos', enf, { rut: pac.rut, codigo_caja: caja.codigo_caja });
    const vin = (await db.query(`SELECT u.rut, v.fecha_vinculo FROM vinculo_caja_paciente v JOIN usuario u ON u.id = v.usuario_id
        WHERE v.caja_fisica_id = $1 ORDER BY v.id DESC LIMIT 1`, [caja.id])).rows[0];
    caso('CP-09', 'RF-03', 'Vincular una caja a un paciente', 'Vínculo guardado con usuario y fecha',
        `${r.status}, firmado por ${vin?.rut}, fecha ${vin?.fecha_vinculo ? 'registrada' : 'NO'}`, r.status < 300 && vin?.rut === USUARIOS.enfermera && !!vin.fecha_vinculo);

    // CP-10 pacientes de una caja: código vacío / inexistente
    r = await api('GET', '/api/cajas/%20/pacientes', enf);
    const r10 = await api('GET', '/api/cajas/CAJA-9999/pacientes', enf);
    caso('CP-10', 'RF-03', 'Consultar pacientes de una caja con código vacío o inexistente', '400 / 404', `${r.status} / ${r10.status}`, r.status === 400 && r10.status === 404);

    // CP-11 despacho con stock suficiente
    const area = (await db.query(`SELECT id FROM area WHERE nombre LIKE 'Pabellón%' ORDER BY id LIMIT 1`)).rows[0].id;
    const sol = (await api('POST', '/api/solicitudes', enf, { area_id: area, tipo_cirugia: 'Programada', inventario_id: caja.inventario_id })).json.id;
    await db.query('UPDATE inventario SET cantidad_disponible = GREATEST(cantidad_disponible, 5) WHERE id = $1', [caja.inventario_id]);
    const antes = (await db.query('SELECT cantidad_disponible FROM inventario WHERE id = $1', [caja.inventario_id])).rows[0].cantidad_disponible;
    r = await api('PUT', `/api/solicitudes/${sol}/despachar`, tens, { caja_codigo: caja.codigo_caja });
    const despues = (await db.query('SELECT cantidad_disponible FROM inventario WHERE id = $1', [caja.inventario_id])).rows[0].cantidad_disponible;
    const est = (await db.query('SELECT estado FROM solicitud WHERE id = $1', [sol])).rows[0].estado;
    caso('CP-11', 'RF-01', 'Despachar una solicitud con stock suficiente', 'Estado Despachado y stock descontado',
        `${r.status}, estado ${est}, stock ${antes} → ${despues}`, r.status === 200 && est === 'Despachado' && despues === antes - 1);

    // CP-12 reporte filtrado (el CSV se arma en el navegador con estas mismas filas)
    r = await api('GET', `/api/reportes/trazabilidad?codigo=${caja.codigo_caja}`, it);
    const filas = Array.isArray(r.json) ? r.json : [];
    caso('CP-12', 'RF-05', 'Reporte de trazabilidad filtrado por caja (base del CSV)', 'Solo filas de la caja filtrada',
        `${r.status}, ${filas.length} filas, todas de ${caja.codigo_caja}: ${filas.every(f => f.codigo_caja === caja.codigo_caja) ? 'sí' : 'NO'}`,
        r.status === 200 && filas.length > 0 && filas.every(f => f.codigo_caja === caja.codigo_caja));

    // CP-13 tiempo de respuesta del dashboard (mediana de 5, API local -> Neon)
    const tiempos = [];
    for (let i = 0; i < 5; i++) tiempos.push((await api('GET', '/api/dashboard', it)).ms);
    const mediana = tiempos.sort((a, b) => a - b)[2];
    caso('CP-13', 'RNF rendimiento', 'Respuesta de la API del dashboard (mediana de 5)', '≤ 2 s', `${mediana} ms (${tiempos.join(', ')})`, mediana <= 2000);

    // CP-14 primera petición a producción (Render free se duerme a los 15 min)
    r = await api('GET', '/api/health', null, null, PRODUCCION).catch(e => ({ status: 0, ms: 0, json: e.message }));
    caso('CP-14', 'RNF disponibilidad', 'Primera petición a producción tras inactividad', '≤ 30 s', `${r.status} en ${(r.ms / 1000).toFixed(1)} s`, r.status === 200 && r.ms <= 30000,
        r.ms > 5000 ? 'Arranque en frío del plan gratuito (PB-07)' : 'El servidor ya estaba despierto');

    const ok = resultados.filter(x => x.ok).length;
    const md = [
        `# Casos de prueba CP-01 a CP-14 — SICTEQ (PB-08)`,
        ``,
        `- Fecha: ${inicio.toLocaleString('es-CL', { timeZone: 'America/Santiago' })}`,
        `- API: ${API} · Base: ${new URL(URL_DB).host.split('.')[0]} (rama de pruebas) · CP-14 contra ${PRODUCCION}`,
        `- Resultado: **${ok} de ${resultados.length} casos aprobados**`,
        ``,
        `| Caso | Requisito | Descripción | Resultado esperado | Resultado obtenido | Estado |`,
        `|---|---|---|---|---|---|`,
        ...resultados.map(x => `| ${x.cp} | ${x.req} | ${x.nombre} | ${x.esperado} | ${x.obtenido}${x.detalle ? `<br><small>${x.detalle}</small>` : ''} | ${x.ok ? '✅' : '❌'} |`),
    ].join('\n');
    if (salida) fs.writeFileSync(salida, md, 'utf8');
    console.log(`\n${ok}/${resultados.length} aprobados${salida ? ` — evidencia en ${salida}` : ''}`);
    await db.end();
    process.exit(ok === resultados.length ? 0 : 1);
})().catch(async (e) => { console.error('Error en las pruebas:', e); await db.end(); process.exit(1); });
