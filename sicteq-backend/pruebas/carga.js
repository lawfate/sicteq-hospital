// PB-08: prueba de carga y estrés sin dependencias (equivalente a un script k6).
// Fase 1 "uso real": 50 usuarios concurrentes, 1 s de pausa entre acciones.
// Fase 2 "estrés": usuarios sin pausa, subiendo hasta encontrar el punto de quiebre.
// Solo lee datos (pantallas de consulta), pero inicia sesión con las cuentas del
// mock: correr contra el backend local apuntando a la rama de pruebas.
//
// Uso:  node pruebas/carga.js --confirmo-base-de-pruebas [salida.md]
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'http://localhost:4000';
const URL_DB = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '..', '.env.pruebas'))).DATABASE_URL;
if (!process.argv.includes('--confirmo-base-de-pruebas') || !new URL(URL_DB).host.startsWith('ep-odd-art') || !/localhost|127\.0\.0\.1/.test(API)) {
    console.error('Solo contra el backend local con la rama de pruebas, y con --confirmo-base-de-pruebas.');
    process.exit(1);
}
const salida = process.argv.slice(2).find(a => a.endsWith('.md'));
const RUTS = ['11111111-1', '22222222-2', '33333333-3', '15678234-3', '16890345-6', '17234567-0', '18345678-4',
    '19456789-8', '17567890-5', '16678901-K', '18789012-8', '19890123-7', '15901234-4'];

// Mezcla de pantallas que más se usan en la Central (todas de consulta).
const RUTAS = ['/api/dashboard', '/api/alertas', '/api/cajas/circulacion', '/api/ciclos',
    '/api/trazabilidad/buscar/CAJA-00', '/api/solicitudes?estado=Pendiente', '/api/inventario', '/api/indicadores?dias=30'];
const espera = (ms) => new Promise(r => setTimeout(r, ms));

async function fase(nombre, usuarios, segundos, pausaMs, tokens) {
    const tiempos = [], errores = {};
    let enCurso = true;
    const vu = async (i) => {
        const token = tokens[i % tokens.length];
        while (enCurso) {
            let ruta = RUTAS[Math.floor(Math.random() * RUTAS.length)];
            if (ruta.endsWith('CAJA-00')) ruta += String(1 + Math.floor(Math.random() * 80)).padStart(2, '0');
            const t0 = performance.now();
            try {
                const r = await fetch(API + ruta, { headers: { Authorization: `Bearer ${token}` } });
                await r.arrayBuffer();
                if (r.status >= 400) errores[r.status] = (errores[r.status] || 0) + 1;
                else tiempos.push(performance.now() - t0);
            } catch (e) {
                errores[e.cause?.code || e.message] = (errores[e.cause?.code || e.message] || 0) + 1;
            }
            if (pausaMs) await espera(pausaMs);
        }
    };
    const t0 = Date.now();
    const vus = Array.from({ length: usuarios }, (_, i) => vu(i));
    await espera(segundos * 1000);
    enCurso = false;
    await Promise.all(vus);
    const dur = (Date.now() - t0) / 1000;
    tiempos.sort((a, b) => a - b);
    const p = (q) => Math.round(tiempos[Math.min(tiempos.length - 1, Math.floor(q * tiempos.length))] || 0);
    const nErr = Object.values(errores).reduce((a, b) => a + b, 0);
    const res = { nombre, usuarios, segundos: Math.round(dur), ok: tiempos.length, errores: nErr, detalleErrores: errores,
        rps: +(tiempos.length / dur).toFixed(1), p50: p(0.5), p95: p(0.95), p99: p(0.99), max: Math.round(tiempos.at(-1) || 0),
        tasaError: +((100 * nErr) / Math.max(1, tiempos.length + nErr)).toFixed(2) };
    console.log(`${nombre.padEnd(30)} ${String(usuarios).padStart(3)} VU  ${res.rps} req/s  p50 ${res.p50} ms  p95 ${res.p95} ms  p99 ${res.p99} ms  errores ${res.tasaError}%`);
    return res;
}

(async () => {
    const inicio = new Date();
    const tokens = [];
    for (const rut of RUTS) {
        const r = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rut, password: '123456' }) });
        const j = await r.json();
        if (j.token) tokens.push(j.token);
    }
    if (tokens.length < RUTS.length) console.warn(`Ojo: solo ${tokens.length} de ${RUTS.length} cuentas iniciaron sesión.`);

    const fases = [];
    fases.push(await fase('Uso real (pausa 1 s)', 50, 60, 1000, tokens));
    for (const n of [25, 50, 100, 200]) fases.push(await fase(`Estrés sin pausa`, n, 20, 0, tokens));

    const real = fases[0];
    const ok = real.p95 <= 2000 && real.tasaError < 1;
    const quiebre = fases.slice(1).find(f => f.p95 > 2000 || f.tasaError >= 1);
    const md = [
        `# Prueba de carga y estrés — SICTEQ (PB-08)`,
        ``,
        `- Fecha: ${inicio.toLocaleString('es-CL', { timeZone: 'America/Santiago' })}`,
        `- Backend: ${API} (Node local) · Base: rama de pruebas de Neon (plan gratuito) · ${tokens.length} cuentas reales repartidas entre los usuarios virtuales`,
        `- Mezcla de pantallas: ${RUTAS.map(r => '`' + r.replace(/CAJA-00$/, 'CAJA-00NN') + '`').join(', ')}`,
        `- Criterio del plan de pruebas: **50 usuarios concurrentes con respuesta ≤ 2 s** y punto de quiebre documentado`,
        `- Resultado: **${ok ? 'CUMPLE' : 'NO CUMPLE'}** — con 50 usuarios el 95% de las respuestas tardó ${real.p95} ms y hubo ${real.tasaError}% de errores`,
        `- Punto de quiebre: ${quiebre ? `con **${quiebre.usuarios} usuarios sin pausa** el p95 sube a ${quiebre.p95} ms (errores ${quiebre.tasaError}%)` : 'no se alcanzó con 200 usuarios sin pausa'}`,
        ``,
        `| Fase | Usuarios | Duración | Peticiones OK | req/s | p50 | p95 | p99 | Máx | Errores |`,
        `|---|---|---|---|---|---|---|---|---|---|`,
        ...fases.map(f => `| ${f.nombre} | ${f.usuarios} | ${f.segundos} s | ${f.ok} | ${f.rps} | ${f.p50} ms | ${f.p95} ms | ${f.p99} ms | ${f.max} ms | ${f.tasaError}% ${f.errores ? JSON.stringify(f.detalleErrores) : ''} |`),
        ``,
        `"Uso real" = cada usuario espera 1 s entre acciones (una persona no hace más de una consulta por segundo). "Estrés" = sin pausa, para encontrar el límite.`,
    ].join('\n');
    if (salida) fs.writeFileSync(salida, md, 'utf8');
    console.log(`\n${ok ? 'CUMPLE' : 'NO CUMPLE'}${salida ? ` — evidencia en ${salida}` : ''}`);
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error('Error en la prueba de carga:', e); process.exit(1); });
