// PB-08: revisión de seguridad automatizada según OWASP Top 10 (2021), en
// reemplazo de un escaneo con OWASP ZAP. Solo lee datos (los intentos de
// inyección no escriben nada); el bloqueo por intentos (A07) ya lo prueba evidencias.js.
//
// Uso:  node pruebas/seguridad.js --confirmo-base-de-pruebas [salida.md]
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const API = process.env.API_URL || 'http://localhost:4000';
const URL_DB = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '..', '.env.pruebas'))).DATABASE_URL;
if (!process.argv.includes('--confirmo-base-de-pruebas') || !new URL(URL_DB).host.startsWith('ep-odd-art')) {
    console.error('Solo contra la rama de pruebas y con --confirmo-base-de-pruebas.');
    process.exit(1);
}
const salida = process.argv.slice(2).find(a => a.endsWith('.md'));
const db = new Pool({ connectionString: URL_DB, ssl: { rejectUnauthorized: false } });
const resultados = [];

const api = async (metodo, ruta, token, body, extra = {}) => {
    const r = await fetch(API + ruta, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
        body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
    });
    const texto = await r.text();
    return { status: r.status, texto, headers: r.headers };
};
const login = async (rut) => JSON.parse((await api('POST', '/api/auth/login', null, { rut, password: '123456' })).texto).token;
const control = (owasp, nombre, ok, obtenido) => {
    resultados.push({ owasp, nombre, ok, obtenido });
    console.log(`${ok ? 'OK   ' : 'FALLA'} ${owasp} ${nombre} -> ${obtenido}`);
};
// Rastros típicos de un error de base de datos filtrado al cliente.
const FUGA = /syntax|invalid input|relation|column|pg_|sql|stack|at \w+ \(/i;

(async () => {
    const inicio = new Date();
    const it = await login('33333333-3');
    const tens = await login('22222222-2');

    // A01 Control de acceso
    const protegidas = ['/api/dashboard', '/api/areas', '/api/trazabilidad/buscar/CAJA-0001', '/api/solicitudes', '/api/inventario',
        '/api/cajas/circulacion', '/api/pacientes', '/api/vinculos', '/api/alertas', '/api/reportes/trazabilidad', '/api/ciclos',
        '/api/auditoria', '/api/indicadores'];
    const abiertas = [];
    for (const r of protegidas) if ((await api('GET', r)).status !== 401) abiertas.push(r);
    control('A01', `Las ${protegidas.length} rutas protegidas exigen sesión`, abiertas.length === 0, abiertas.length ? `abiertas: ${abiertas.join(', ')}` : 'todas 401 sin token');
    const porRol = [['GET', '/api/auditoria'], ['GET', '/api/pacientes'], ['GET', '/api/reportes/vinculos'], ['GET', '/api/reportes/trazabilidad'], ['GET', '/api/cajas/CAJA-0001/pacientes'], ['PUT', '/api/ciclos/1/resultado']];
    const sinFreno = [];
    for (const [m, r] of porRol) if ((await api(m, r, tens, m === 'PUT' ? { resultado: 'Estéril' } : undefined)).status !== 403) sinFreno.push(r);
    control('A01', 'TENS no accede a auditoría, datos de pacientes, reportes ni liberación de cargas', sinFreno.length === 0, sinFreno.length ? `sin freno: ${sinFreno.join(', ')}` : `${porRol.length} rutas → 403`);

    // A02 Fallas criptográficas
    const claves = (await db.query(`SELECT COUNT(*) FILTER (WHERE password_hash LIKE '$2%')::int AS bcrypt, COUNT(*)::int AS total FROM usuario`)).rows[0];
    control('A02', 'Contraseñas guardadas con bcrypt (nunca en texto plano)', claves.bcrypt === claves.total, `${claves.bcrypt}/${claves.total} con bcrypt`);
    const sinFirma = [jwt.decode(it, { complete: true })].map(t => `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify(t.payload)).toString('base64url')}.`)[0];
    const otraClave = jwt.sign(jwt.decode(it), 'clave-adivinada-por-un-atacante-0123456789');
    const r1 = await api('GET', '/api/dashboard', sinFirma), r2 = await api('GET', '/api/dashboard', otraClave);
    control('A02', 'Token sin firma (alg "none") o firmado con otra clave se rechaza', r1.status === 401 && r2.status === 401, `alg none ${r1.status}, otra clave ${r2.status}`);

    // A03 Inyección (SQL): las consultas usan parámetros, el payload se trata como texto
    const payloads = [`' OR '1'='1`, `CAJA-0001'; DROP TABLE usuario;--`, `1 UNION SELECT password FROM usuario`];
    const fallas = [];
    for (const p of payloads) {
        const e = encodeURIComponent(p);
        for (const [m, ruta, body] of [['GET', `/api/trazabilidad/buscar/${e}`], ['GET', `/api/reportes/trazabilidad?codigo=${e}`],
            ['GET', `/api/ciclos?maquina=${e}`], ['POST', '/api/vinculos', { rut: p, codigo_caja: p }], ['POST', '/api/auth/login', { rut: p, password: p }]]) {
            const r = await api(m, ruta, m === 'POST' && ruta.includes('auth') ? null : it, body);
            const datos = r.status === 200 && ruta.includes('/buscar/') && r.texto.length > 2; // ese código no existe: no debe devolver filas
            if (r.status >= 500 || FUGA.test(r.texto) || datos || r.texto.includes('$2')) fallas.push(`${m} ${ruta.split('?')[0]} (${r.status})`);
        }
    }
    const usuariosSiguen = (await db.query('SELECT COUNT(*)::int AS n FROM usuario')).rows[0].n;
    control('A03', `Inyección SQL: ${payloads.length} ataques × 5 entradas sin efecto ni fuga`, fallas.length === 0 && usuariosSiguen > 0, fallas.length ? fallas.join('; ') : `sin errores 500 ni datos filtrados; tabla usuario intacta (${usuariosSiguen})`);
    const etapa = await api('POST', '/api/trazabilidad/actualizar', it, { codigo: 'CAJA-0001', stage: '<script>alert(1)</script>' });
    control('A03', 'Etapa con texto arbitrario se rechaza (antes se guardaba)', etapa.status === 400, `${etapa.status}`);

    // A04 Diseño inseguro: límite de tamaño de petición
    const grande = await api('POST', '/api/solicitudes', it, JSON.stringify({ observaciones: 'x'.repeat(300 * 1024) }));
    control('A04', 'Petición de 300 KB se rechaza (límite 100 KB)', grande.status === 413, `${grande.status}`);

    // A05 Configuración: cabeceras y errores sin detalles internos
    const h = (await api('GET', '/api/health')).headers;
    const faltan = ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'strict-transport-security'].filter(k => !h.get(k));
    control('A05', 'Cabeceras de seguridad presentes y sin X-Powered-By', faltan.length === 0 && !h.get('x-powered-by'), faltan.length ? `faltan ${faltan.join(', ')}` : `ok; x-powered-by: ${h.get('x-powered-by') || 'oculto'}`);
    const d = await api('GET', '/api/dashboard', it);
    control('A05', 'Respuestas con datos de pacientes no se guardan en caché', d.headers.get('cache-control') === 'no-store', `cache-control: ${d.headers.get('cache-control')}`);
    const malas = [await api('GET', '/api/reportes/trazabilidad?desde=no-es-fecha', it), await api('GET', '/api/solicitudes?area_id=abc', it), await api('POST', '/api/auth/login', null, '{json roto')];
    control('A05', 'Filtros o JSON inválidos: 400 sin detalles de la base de datos', malas.every(r => r.status === 400 && !FUGA.test(r.texto)), malas.map(r => `${r.status} ${r.texto.slice(0, 60)}`).join(' | '));
    const cors = (await api('GET', '/api/health', null, undefined, { Origin: 'https://sitio-ajeno.example' })).headers.get('access-control-allow-origin');
    control('A05', 'CORS no autoriza sitios ajenos', !cors, `access-control-allow-origin: ${cors || '(ninguno)'}`);

    // A06 Componentes vulnerables
    const audit = (dir) => {
        let out;
        try { out = execSync('npm audit --omit=dev --json', { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { out = e.stdout; }
        return JSON.parse(out).metadata.vulnerabilities;
    };
    const vb = audit(path.join(__dirname, '..')), vf = audit(path.join(__dirname, '..', '..', 'sicteq-frontend'));
    const graves = vb.high + vb.critical + vf.high + vf.critical;
    control('A06', 'Dependencias sin vulnerabilidades altas ni críticas (npm audit)', graves === 0, `backend ${vb.total} (altas+críticas ${vb.high + vb.critical}) · frontend ${vf.total} (altas+críticas ${vf.high + vf.critical})`);

    // A07 Autenticación: sesión única (el bloqueo por 5 intentos lo prueba evidencias.js)
    const t1 = await login('15901234-4'); await login('15901234-4');
    const s = await api('GET', '/api/dashboard', t1);
    control('A07', 'Al iniciar sesión en otro equipo, la sesión anterior deja de valer', s.status === 401, `${s.status}`);

    // A09 Registro y monitoreo: los intentos rechazados quedan en auditoría
    const aud = (await db.query(`SELECT COUNT(*)::int AS n FROM auditoria WHERE fecha >= $1`, [inicio.toISOString().replace('T', ' ').slice(0, 19)])).rows[0].n;
    control('A09', 'Las acciones de la prueba quedaron en la auditoría', aud > 0, `${aud} eventos registrados durante la prueba`);

    const ok = resultados.filter(x => x.ok).length;
    const md = [
        `# Revisión de seguridad OWASP Top 10 — SICTEQ (PB-08)`,
        ``,
        `- Fecha: ${inicio.toLocaleString('es-CL', { timeZone: 'America/Santiago' })}`,
        `- API: ${API} · Base: rama de pruebas de Neon · Herramienta: script propio (pruebas/seguridad.js) + npm audit`,
        `- Resultado: **${ok} de ${resultados.length} controles aprobados**`,
        ``,
        `| OWASP | Control | Resultado | Estado |`,
        `|---|---|---|---|`,
        ...resultados.map(x => `| ${x.owasp} | ${x.nombre} | ${String(x.obtenido).replace(/\|/g, '/')} | ${x.ok ? '✅' : '❌'} |`),
        ``,
        `Fuera de este script: A07 bloqueo tras 5 intentos y cierre a los 30 min (pruebas/evidencias.js), A08 integridad (los respaldos van cifrados con AES-256-GCM y se verifican por hash, PB-12), A10 SSRF (el sistema no hace peticiones a URLs que entregue el usuario).`,
    ].join('\n');
    if (salida) fs.writeFileSync(salida, md, 'utf8');
    console.log(`\n${ok}/${resultados.length} aprobados${salida ? ` — evidencia en ${salida}` : ''}`);
    await db.end();
    process.exit(ok === resultados.length ? 0 : 1);
})().catch(async (e) => { console.error('Error en la revisión:', e); await db.end(); process.exit(1); });
