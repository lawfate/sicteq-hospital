// Pruebas de aceptación del Sprint 1-2 (PB-01, PB-02, PB-04, PB-05) que a la
// vez generan la evidencia en Markdown para el informe/PPT.
//
// ESCRIBE DATOS (cargas, movimientos, vínculos): correr solo contra una base
// de pruebas (rama de Neon), nunca contra la de producción.
//
// Uso (con el backend corriendo en local apuntando a la rama de pruebas):
//   node pruebas/evidencias.js --confirmo-base-de-pruebas [salida.md]
require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const API = process.env.API_URL || 'http://localhost:4000';
if (!process.argv.includes('--confirmo-base-de-pruebas')) {
    console.error('Este script escribe datos. Agrega --confirmo-base-de-pruebas si DATABASE_URL es la rama de pruebas.');
    console.error('DATABASE_URL apunta a:', new URL(process.env.DATABASE_URL).host);
    process.exit(1);
}
const salida = process.argv.slice(2).find(a => a.endsWith('.md'));
const db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const USUARIOS = { enfermera: '11111111-1', tens: '22222222-2', it: '33333333-3' };
const resultados = [];

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
const login = async (quien) => (await api('POST', '/api/auth/login', null, { rut: USUARIOS[quien], password: '123456' })).json.token;

const check = (pb, nombre, esperado, obtenido, respuesta) => {
    const ok = esperado === obtenido;
    resultados.push({ pb, nombre, esperado, obtenido, ok, respuesta });
    console.log(`${ok ? 'OK  ' : 'FALLA'} [${pb}] ${nombre} -> esperado ${esperado}, obtenido ${obtenido}`);
};
const resumen = (j) => JSON.stringify(j).slice(0, 220);

(async () => {
    const inicio = new Date();

    // ---------------- PB-02: sesión única ----------------
    const e1 = await login('enfermera');
    const e2 = await login('enfermera');
    let r = await api('GET', '/api/dashboard', e1);
    check('PB-02', 'Sesión anterior queda inválida al iniciar sesión en otro equipo', '401 sesion_reemplazada', `${r.status} ${r.json.motivo}`, r.json);
    r = await api('GET', '/api/dashboard', e2);
    check('PB-02', 'La sesión nueva sigue funcionando', 200, r.status, '');

    // ---------------- PB-02: cierre por inactividad ----------------
    await db.query(`UPDATE usuario SET ultima_actividad = NOW() - INTERVAL '31 minutes' WHERE rut = $1`, [USUARIOS.enfermera]);
    r = await api('GET', '/api/dashboard', e2);
    check('PB-02', 'Sesión con 31 min sin uso se cierra', '401 inactividad', `${r.status} ${r.json.motivo}`, r.json);

    // ---------------- PB-02: permisos por rol ----------------
    const enf = await login('enfermera');
    const tens = await login('tens');
    const it = await login('it');
    r = await api('GET', '/api/pacientes', tens);
    check('PB-02', 'TENS no puede ver RUT ni datos de pacientes', 403, r.status, r.json);
    r = await api('GET', '/api/pacientes', enf);
    check('PB-02', 'Enfermera sí ve pacientes', 200, r.status, `${Array.isArray(r.json) ? r.json.length : '?'} pacientes`);
    const paciente = Array.isArray(r.json) ? r.json[0] : null;
    r = await api('POST', '/api/vinculos', tens, { rut: paciente?.rut, codigo_caja: 'X' });
    check('PB-02', 'TENS no puede vincular caja a paciente', 403, r.status, r.json);

    // ---------------- PB-04 / PB-05: carga de autoclave ----------------
    const cajas = (await db.query(`SELECT id, codigo_caja FROM caja_fisica WHERE estado = 'En circulación' ORDER BY id LIMIT 2`)).rows;
    if (cajas.length < 2) throw new Error('Se necesitan al menos 2 cajas físicas en circulación en la base de pruebas.');
    const [c1, c2] = cajas;
    const numCiclo = Number(String(Date.now()).slice(-6));
    const params = { metodo: 'Autoclave', temperatura: 134, presion: '2.1 bar', tiempo_minutos: 18 };

    r = await api('POST', '/api/ciclos', tens, { numero_maquina: 2, numero_ciclo: numCiclo, ...params, cajas: [c1.codigo_caja, c2.codigo_caja] });
    check('PB-04', `TENS registra la carga M2-C${numCiclo} con 2 cajas`, 201, r.status, r.json.identificador);
    const ciclo1 = r.json.id;
    r = await api('POST', '/api/ciclos', tens, { numero_maquina: 2, numero_ciclo: numCiclo, cajas: [c1.codigo_caja] });
    check('PB-04', 'No se puede repetir el identificador de carga', 409, r.status, r.json);
    r = await api('GET', `/api/ciclos?maquina=2&numero=${numCiclo}`, tens);
    check('PB-04', 'Se consulta la carga por su identificador (como el voucher)', 1, Array.isArray(r.json) ? r.json.length : 0, resumen(r.json[0]));

    r = await api('POST', '/api/trazabilidad/actualizar', tens, { codigo: c1.codigo_caja, stage: 5, temperatura: 134 });
    check('PB-04', 'Caja de una carga En proceso no pasa a Almacenamiento', 409, r.status, r.json);
    r = await api('PUT', `/api/ciclos/${ciclo1}/resultado`, tens, { resultado: 'Estéril' });
    check('PB-02', 'TENS no puede liberar la carga', 403, r.status, r.json);
    r = await api('PUT', `/api/ciclos/${ciclo1}/resultado`, enf, { resultado: 'No estéril' });
    check('PB-04', 'Carga No estéril exige observación', 400, r.status, r.json);
    r = await api('PUT', `/api/ciclos/${ciclo1}/resultado`, enf, { resultado: 'No estéril', observacion: 'Corte de luz durante el ciclo' });
    check('PB-04', 'Enfermera marca la carga No estéril', 200, r.status, `cajas afectadas: ${r.json.cajas_afectadas}`);
    const ult = (await db.query(`SELECT estado_nuevo, justificacion FROM historial_movimiento WHERE caja_fisica_id = $1 ORDER BY fecha_cambio DESC, id DESC LIMIT 1`, [c1.id])).rows[0];
    check('PB-04', 'La caja vuelve a Lavado (reproceso)', 'Etapa 2', ult.estado_nuevo, ult.justificacion);
    r = await api('POST', '/api/trazabilidad/actualizar', tens, { codigo: c1.codigo_caja, stage: 5, temperatura: 134 });
    check('PB-04', 'Caja de carga No estéril queda bloqueada', 409, r.status, r.json);

    r = await api('POST', '/api/ciclos', tens, { numero_maquina: 2, numero_ciclo: numCiclo + 1, ...params, cajas: [c1.codigo_caja] });
    const ciclo2 = r.json.id;
    r = await api('PUT', `/api/ciclos/${ciclo2}/resultado`, enf, { resultado: 'Estéril' });
    check('PB-04', `Nueva carga M2-C${numCiclo + 1} liberada como Estéril`, 200, r.status, '');
    r = await api('POST', '/api/trazabilidad/actualizar', tens, { codigo: c1.codigo_caja, stage: 5 });
    check('Req. 1', 'Almacenamiento sin parámetros ni comentario se rechaza en el servidor', 400, r.status, r.json);
    r = await api('POST', '/api/trazabilidad/actualizar', tens, { codigo: c1.codigo_caja, stage: 5, ...params, tiempoMinutos: 18 });
    check('PB-04', 'Con carga Estéril la caja pasa a Almacenamiento', 200, r.status, r.json);
    const cad = (await db.query(`SELECT ROUND(EXTRACT(EPOCH FROM (fecha_caducidad - NOW())) / 86400) AS dias FROM caja_fisica WHERE id = $1`, [c1.id])).rows[0];
    check('PB-05', 'Vigencia del empaque por defecto = 365 días', 365, Number(cad.dias), `${cad.dias} días hasta la caducidad`);

    // ---------------- Despacho seguro ----------------
    const area = (await db.query(`SELECT id FROM area WHERE nombre LIKE 'Pabellón%' ORDER BY id LIMIT 1`)).rows[0].id;
    const nuevaSol = async () => (await api('POST', '/api/solicitudes', enf, { area_id: area, tipo_cirugia: 'Programada', instrumental: 'Prueba de despacho seguro' })).json.id;
    let sol = await nuevaSol();
    r = await api('PUT', `/api/solicitudes/${sol}/despachar`, tens, { caja_codigo: c2.codigo_caja });
    check('Despacho', 'No se despacha una caja que no está en Almacenamiento', 409, r.status, r.json);
    // Alguien la marca en Almacenamiento saltándose el proceso: igual la frena la carga No estéril.
    await db.query(`INSERT INTO historial_movimiento (inventario_id, caja_fisica_id, estado_nuevo, fecha_cambio, justificacion)
                    SELECT inventario_id, id, 'Etapa 5', NOW(), 'Prueba: almacenada sin carga estéril' FROM caja_fisica WHERE id = $1`, [c2.id]);
    await db.query(`UPDATE caja_fisica SET fecha_caducidad = NOW() + INTERVAL '365 days' WHERE id = $1`, [c2.id]);
    r = await api('PUT', `/api/solicitudes/${sol}/despachar`, tens, { caja_codigo: c2.codigo_caja });
    check('Despacho', 'No se despacha una caja de una carga No estéril', 409, r.status, r.json);
    await db.query(`UPDATE caja_fisica SET fecha_caducidad = NOW() - INTERVAL '1 day' WHERE id = $1`, [c1.id]);
    r = await api('PUT', `/api/solicitudes/${sol}/despachar`, tens, { caja_codigo: c1.codigo_caja });
    check('Despacho', 'No se despacha una caja con el empaque vencido', 409, r.status, r.json);
    await db.query(`UPDATE caja_fisica SET fecha_caducidad = NOW() + INTERVAL '365 days' WHERE id = $1`, [c1.id]);
    r = await api('PUT', `/api/solicitudes/${sol}/despachar`, enf, { caja_codigo: c1.codigo_caja });
    check('PB-02', 'Enfermera no despacha (rol TENS/IT)', 403, r.status, r.json);
    r = await api('PUT', `/api/solicitudes/${sol}/despachar`, tens, { caja_codigo: c1.codigo_caja });
    check('Despacho', 'Caja almacenada, de carga Estéril y vigente: se despacha', 200, r.status, r.json);
    r = await api('PUT', `/api/solicitudes/${sol}/despachar`, tens, { caja_codigo: c1.codigo_caja });
    check('Despacho', 'Una solicitud ya despachada no se despacha de nuevo', 409, r.status, r.json);

    // ---------------- PB-03 / PB-11: seguridad ----------------
    const jwt = require('jsonwebtoken');
    const falso = jwt.sign({ id: 3, rol: 'IT', rol_id: 3, sid: 'x' }, 'sicteq-dev-fallback-secret-inseguro-configurar-en-produccion');
    r = await api('GET', '/api/auditoria', falso);
    check('PB-03', 'Token firmado con el antiguo secreto de respaldo se rechaza', 401, r.status, r.json);
    const cors = async (origen) => (await fetch(API + '/api/health', { headers: { Origin: origen } })).headers.get('access-control-allow-origin');
    check('PB-03', 'CORS: el frontend propio está permitido', 'http://localhost:5173', await cors('http://localhost:5173'), '');
    check('PB-03', 'CORS: un sitio ajeno no recibe permiso', 'null', String(await cors('https://sitio-ajeno.example')), '');
    const victima = (await db.query(`SELECT rut FROM usuario WHERE id NOT IN (1, 2, 3) AND activo ORDER BY id DESC LIMIT 1`)).rows[0].rut;
    let ultimo;
    for (let i = 1; i <= 5; i++) ultimo = await api('POST', '/api/auth/login', null, { rut: victima, password: 'clave-equivocada' });
    check('PB-11', '5 intentos fallidos bloquean la cuenta', 429, ultimo.status, ultimo.json);
    r = await api('POST', '/api/auth/login', null, { rut: victima, password: '123456' });
    check('PB-11', 'Bloqueada, ni con la clave correcta entra (15 min)', 429, r.status, r.json);
    await db.query('UPDATE usuario SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE rut = $1', [victima]);

    // ---------------- PB-01: auditoría ----------------
    if (paciente) await api('GET', `/api/pacientes/${encodeURIComponent(paciente.rut)}`, enf);
    const tensId = (await db.query('SELECT id FROM usuario WHERE rut = $1', [USUARIOS.tens])).rows[0].id;
    r = await api('POST', '/api/vinculos', enf, { rut: paciente?.rut, codigo_caja: c2.codigo_caja, usuario_id: tensId });
    const v = (await db.query(`SELECT u.rut FROM vinculo_caja_paciente v JOIN usuario u ON u.id = v.usuario_id ORDER BY v.id DESC LIMIT 1`)).rows[0];
    check('PB-01', 'El vínculo se firma con el usuario del token aunque el body diga otro', USUARIOS.enfermera, v?.rut, `body mandó usuario_id=${tensId} (TENS)`);

    r = await api('GET', '/api/auditoria', tens);
    check('PB-01', 'TENS no puede ver la auditoría', 403, r.status, r.json);
    r = await api('GET', `/api/auditoria?desde=${encodeURIComponent(inicio.toISOString())}&limite=500`, it);
    check('PB-01', 'IT consulta la auditoría', 200, r.status, '');
    const acciones = new Set((Array.isArray(r.json) ? r.json : []).map(a => a.accion));
    for (const a of ['login', 'crear_ciclo', 'resultado_ciclo', 'etapa_bloqueada', 'cambio_etapa', 'consulta_ficha_paciente', 'vinculo_caja_paciente', 'despacho_bloqueado', 'despachar_solicitud', 'cuenta_bloqueada']) {
        check('PB-01', `Queda registrada la acción "${a}"`, true, acciones.has(a), '');
    }
    const muestra = (Array.isArray(r.json) ? r.json : []).slice(0, 12);

    // ---------------- Reporte ----------------
    const ok = resultados.filter(x => x.ok).length;
    const md = [
        `# Evidencia de pruebas — Sprint noviembre SICTEQ`,
        ``,
        `- Fecha: ${inicio.toLocaleString('es-CL')}`,
        `- API: ${API} · Base: ${new URL(process.env.DATABASE_URL).host.split('.')[0]} (rama de pruebas)`,
        `- Resultado: **${ok} de ${resultados.length} pruebas aprobadas**`,
        ``,
        `| # | PB | Prueba | Esperado | Obtenido | Estado |`,
        `|---|---|---|---|---|---|`,
        ...resultados.map((x, i) => `| ${i + 1} | ${x.pb} | ${x.nombre} | ${x.esperado} | ${x.obtenido} | ${x.ok ? '✅' : '❌'} |`),
        ``,
        `## Respuestas del servidor (extracto)`,
        ...resultados.filter(x => x.respuesta).map((x, i) => `- **${x.nombre}:** \`${typeof x.respuesta === 'string' ? x.respuesta : resumen(x.respuesta)}\``),
        ``,
        `## Muestra del registro de auditoría (consultado por IT)`,
        `| Fecha | Usuario | Rol | Acción | Entidad | Detalle |`,
        `|---|---|---|---|---|---|`,
        ...muestra.map(a => `| ${new Date(a.fecha).toLocaleTimeString('es-CL')} | ${a.usuario ?? '—'} | ${a.rol ?? '—'} | ${a.accion} | ${a.entidad ?? ''} ${a.entidad_id ?? ''} | ${a.detalle ? JSON.stringify(a.detalle).slice(0, 90) : ''} |`),
    ].join('\n');
    if (salida) fs.writeFileSync(salida, md, 'utf8');
    console.log(`\n${ok}/${resultados.length} aprobadas${salida ? ` — evidencia en ${salida}` : ''}`);
    await db.end();
    process.exit(ok === resultados.length ? 0 : 1);
})().catch(async (e) => { console.error('Error en las pruebas:', e); await db.end(); process.exit(1); });
