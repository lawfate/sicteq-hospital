// Datos de prueba (mock) para Neon (rama de pruebas o producción). Simula ~3 semanas de
// operación de la Central de Esterilización: cajas completas que recorren
// Recepción -> Lavado -> Preparación -> Esterilización (cargas de autoclave)
// -> Almacenamiento -> Despacho a pabellón -> vínculo con paciente -> vuelta.
// Basado en la reunión del 31-08: 4 autoclaves, ciclo ~2 h, vigencia 1 año,
// cargas No estéril vuelven a Lavado, solicitudes desde pabellones.
//
// BORRA y recrea todos los datos (menos roles y áreas).
//
// Uso: node pruebas/seed_mock.js --confirmo-base-de-pruebas   (rama de pruebas, .env.pruebas)
//      node pruebas/seed_mock.js --confirmo-produccion         (producción, .env)
// Producción: decisión del equipo (21-11) dejar este mock como base de la demo y
// de la marcha blanca. Respaldar antes con respaldo/respaldo.js.
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DESTINOS = {
    '--confirmo-base-de-pruebas': { env: '.env.pruebas', host: 'ep-odd-art-atyhgd2y' },
    '--confirmo-produccion': { env: '.env', host: 'ep-lively-credit-atqj4ig3' },
};
const flags = Object.keys(DESTINOS).filter(f => process.argv.includes(f));
if (flags.length !== 1) {
    console.error(`Indique exactamente uno: ${Object.keys(DESTINOS).join(' o ')}.`);
    process.exit(1);
}
const destino = DESTINOS[flags[0]];
const URL_DB = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '..', destino.env))).DATABASE_URL;
if (!new URL(URL_DB).host.startsWith(destino.host)) {
    console.error(`${destino.env} no apunta a ${destino.host}: no se toca nada.`);
    process.exit(1);
}
const db = new Pool({ connectionString: URL_DB, ssl: { rejectUnauthorized: false } });

// ---------- utilidades ----------
let semilla = 20261102; // PRNG determinista: mismo resultado en cada corrida
const rnd = () => { semilla |= 0; semilla = (semilla + 0x6D2B79F5) | 0; let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const entre = (a, b) => a + rnd() * (b - a);
const ent = (a, b) => Math.floor(entre(a, b + 1));
const uno = (arr) => arr[Math.floor(rnd() * arr.length)];
const HORA = 3600 * 1000;
const DIA = 24 * HORA;
// La app guarda TIMESTAMP sin zona con NOW() de Neon (UTC): usamos la misma convención.
const ts = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
const dv = (n) => { let s = 0, m = 2; for (const d of String(n).split('').reverse()) { s += Number(d) * m; m = m === 7 ? 2 : m + 1; } const r = 11 - (s % 11); return r === 11 ? '0' : r === 10 ? 'K' : String(r); };
const rutPlano = (n) => `${n}-${dv(n)}`;
const rutPuntos = (n) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv(n)}`;

const insertar = async (c, tabla, cols, filas) => {
    for (let i = 0; i < filas.length; i += 500) {
        const lote = filas.slice(i, i + 500);
        const valores = [];
        const marcas = lote.map((f, j) => `(${cols.map((_, k) => { valores.push(f[k]); return `$${j * cols.length + k + 1}`; }).join(',')})`);
        await c.query(`INSERT INTO ${tabla} (${cols.join(',')}) VALUES ${marcas.join(',')}`, valores);
    }
};

// ---------- catálogos ----------
const CATEGORIAS = ['Cirugía General', 'Laparoscopía', 'Traumatología', 'Ginecología y Obstetricia', 'Cirugía Menor', 'Pediatría', 'Maxilofacial y Dental', 'Cardiovascular'];
// [código, nombre, categoría (1-based), N° de cajas físicas, piezas por caja, stock crítico]
const TIPOS = [
    ['GEN-001', 'Caja Instrumental Mayor', 1, 10, 62, 3],
    ['GEN-002', 'Caja Cirugía Menor', 5, 8, 24, 2],
    ['GEN-003', 'Set Hernioplastía', 1, 5, 38, 2],
    ['GEN-004', 'Set Apendicectomía', 1, 6, 41, 2],
    ['LAP-001', 'Set Laparoscopía Avanzada', 2, 5, 35, 2],
    ['LAP-002', 'Set Colecistectomía', 2, 6, 33, 2],
    ['TRA-001', 'Set Traumatología Mayor', 3, 5, 78, 2],
    ['TRA-002', 'Set Traumatología Cadera', 3, 3, 85, 1],
    ['TRA-003', 'Set Osteosíntesis Mano', 3, 4, 46, 1],
    ['EST-001', 'Set Cesárea Estándar', 4, 8, 45, 3],
    ['EST-002', 'Set Histerectomía', 4, 4, 52, 1],
    ['EST-003', 'Set Parto Vaginal', 4, 6, 18, 2],
    ['ORT-003', 'Set Ortopedia Infantil', 6, 2, 40, 1],
    ['PED-001', 'Set Cirugía Pediátrica', 6, 3, 36, 1],
    ['MAX-001', 'Set Maxilofacial', 7, 3, 44, 1],
    ['CAR-001', 'Set Esternotomía', 8, 2, 70, 1],
];
const PABELLONES = [6, 7, 8, 9, 10, 11, 12, 13, 14, 24]; // ids de area
const PROC = {
    1: ['Laparotomía exploradora', 'Hernioplastía inguinal', 'Apendicectomía', 'Resección intestinal'],
    2: ['Colecistectomía laparoscópica', 'Apendicectomía laparoscópica', 'Funduplicatura laparoscópica'],
    3: ['Fractura expuesta de fémur', 'Artroplastía de cadera', 'Osteosíntesis de radio', 'Fractura de tobillo'],
    4: ['Cesárea programada', 'Cesárea de urgencia', 'Histerectomía total', 'Parto vaginal'],
    5: ['Drenaje de absceso', 'Exéresis de lesión cutánea'],
    6: ['Cirugía pediátrica: hernia', 'Reducción de fractura infantil'],
    7: ['Fractura mandibular', 'Exodoncia compleja'],
    8: ['Revascularización miocárdica'],
};
const NOMBRES = ['Carlos', 'María Paz', 'Juan Alberto', 'Francisca', 'Jorge', 'Camila', 'Pedro', 'Valentina', 'Luis', 'Constanza', 'Manuel', 'Javiera', 'Rodrigo', 'Catalina', 'Héctor', 'Fernanda', 'Andrés', 'Daniela', 'Sergio', 'Isidora', 'Patricio', 'Rosa', 'Cristián', 'Gloria', 'Mauricio', 'Antonia'];
const APELLIDOS = ['Henríquez', 'Contreras', 'Díaz', 'Soto', 'Muñoz', 'Rojas', 'González', 'Pérez', 'Morales', 'Fuentes', 'Araya', 'Valenzuela', 'Tapia', 'Espinoza', 'Castillo', 'Reyes', 'Sepúlveda', 'Vergara', 'Cáceres', 'Navarro'];
const CAUSAS_NO_ESTERIL = ['Corte de luz durante el ciclo', 'Indicador químico sin viraje completo', 'Corte de agua durante el ciclo', 'Falla de vacío en el autoclave', 'Indicador biológico positivo'];

// Personal: los 3 usuarios existentes conservan id, RUT y nombre (las cuentas de prueba siguen igual).
const PERSONAL = [
    [1, '11111111-1', 'Enf. Ana María', 1], [2, '22222222-2', 'TENS Juan Carlos', 2], [3, '33333333-3', 'IT Matías Olguín', 3],
    [4, rutPlano(15678234), 'Enf. Carolina Vidal', 1], [5, rutPlano(16890345), 'Enf. Roberto Salinas', 1], [6, rutPlano(17234567), 'Enf. Daniela Pizarro', 1],
    [7, rutPlano(18345678), 'TENS Marcela Ortiz', 2], [8, rutPlano(19456789), 'TENS Felipe Lagos', 2], [9, rutPlano(17567890), 'TENS Helen Bustos', 2],
    [10, rutPlano(16678901), 'TENS Luis Campos', 2], [11, rutPlano(18789012), 'TENS Paola Ibarra', 2], [12, rutPlano(19890123), 'TENS Cristóbal Mena', 2],
    [13, rutPlano(15901234), 'IT Soporte Informática', 3],
];
const ENFERMERAS = PERSONAL.filter(p => p[3] === 1).map(p => p[0]);
const TENS = PERSONAL.filter(p => p[3] === 2).map(p => p[0]);

(async () => {
    const c = await db.connect();
    const t0 = Date.now();
    try {
        await c.query('BEGIN');
        await c.query(`TRUNCATE auditoria, vinculo_caja_paciente, vinculo_trazabilidad, ciclo_esterilizacion, historial_movimiento,
                       detalle_solicitud, solicitud, caja_fisica, paciente, inventario, categoria, usuario RESTART IDENTITY CASCADE`);

        const hash = await bcrypt.hash('123456', 10);
        await insertar(c, 'usuario', ['id', 'rut', 'nombre', 'rol_id', 'password_hash', 'activo'], PERSONAL.map(p => [...p, hash, true]));
        await insertar(c, 'categoria', ['id', 'nombre'], CATEGORIAS.map((n, i) => [i + 1, n]));

        // Pacientes ficticios (RUT con dígito verificador válido).
        const pacientes = [];
        for (let i = 1; i <= 45; i++) {
            const cat = ent(1, 8);
            const area = cat === 4 ? 13 : cat === 3 ? 12 : cat === 7 ? 24 : cat === 8 ? 14 : uno([6, 7, 8, 9, 10, 11]);
            pacientes.push({ id: i, cat, area, fila: [i, rutPuntos(ent(6000000, 25999999)), `${uno(NOMBRES)} ${uno(APELLIDOS)} ${uno(APELLIDOS)}`, ent(1, 89), area, uno(PROC[cat]), rnd() < 0.12 ? uno(['Portador KPC', 'Antecedente de ISQ', 'Aislamiento de contacto']) : null] });
        }
        await insertar(c, 'paciente', ['id', 'rut', 'nombre', 'edad', 'area_id', 'diagnostico', 'alertas_iaas'], pacientes.map(p => p.fila));

        // Cajas físicas por tipo.
        const cajas = [];
        TIPOS.forEach((tp, i) => { for (let k = 0; k < tp[3]; k++) cajas.push({ id: cajas.length + 1, inv: i + 1, tipo: tp, codigo: `CAJA-${String(cajas.length + 1).padStart(4, '0')}` }); });

        // ---------- simulación por pasos de 30 min ----------
        const AHORA = Date.now();
        const INICIO = Math.floor((AHORA - 21 * DIA) / DIA) * DIA + 7 * HORA;
        const PASO = HORA / 2;
        const hist = [], cargas = [], vincT = [], sols = [], dets = [], vincP = [], audit = [];
        const numCiclo = { 1: 1180, 2: 960, 3: 1415, 4: 705 };
        const ultimoEstado = {};
        const mov = (caja, estado, t, extra = {}) => {
            hist.push({ inv: caja.inv, caja: caja.id, ant: ultimoEstado[caja.id] ?? null, nuevo: estado, t, area: extra.area ?? 3, just: extra.just ?? null, usr: extra.usr ?? uno(TENS), sol: extra.sol ?? null, params: extra.params ?? null });
            if (extra.auditar !== false) audit.push([extra.usr ?? hist[hist.length - 1].usr, 'cambio_etapa', 'caja_fisica', caja.codigo, JSON.stringify({ desde: ultimoEstado[caja.id] ?? null, hacia: estado }), t]);
            ultimoEstado[caja.id] = estado;
        };
        const horaDelDia = (t) => new Date(t).getUTCHours();
        const laboral = (t) => { const h = horaDelDia(t); return h >= 7 && h < 23; };

        // Estado inicial: repartidas en el circuito.
        for (const caja of cajas) {
            caja.etapa = uno([1, 2, 3, 5, 5, 5]);
            caja.prox = INICIO + entre(0, 6) * HORA;
            caja.lista = caja.etapa === 3;
            mov(caja, `Etapa ${caja.etapa}`, INICIO - entre(1, 20) * HORA, { just: 'Estado inicial del periodo', auditar: false });
            if (caja.etapa === 5) caja.caducidad = INICIO + 365 * DIA - entre(1, 30) * DIA;
        }

        const pendientesSol = []; // solicitudes esperando despacho
        let idCarga = 0, idSol = 0;
        for (let t = INICIO; t <= AHORA - HORA; t += PASO) {
            const finde = [0, 6].includes(new Date(t).getUTCDay());
            if (horaDelDia(t) === 7 && (t % HORA) === 0) {
                for (const u of PERSONAL.filter(() => rnd() < (finde ? 0.35 : 0.8))) audit.push([u[0], 'login', 'usuario', u[0], null, t + entre(0, 1.5) * HORA]);
                if (rnd() < 0.3) audit.push([uno(TENS), 'login_fallido', 'usuario', uno(TENS), JSON.stringify({ motivo: 'password_incorrecta' }), t + entre(0, 2) * HORA]);
            }
            if (!laboral(t)) continue;

            // Avance de cajas por etapas internas.
            for (const caja of cajas) {
                if (caja.prox > t || caja.enCarga || caja.enPabellon) continue;
                if (caja.etapa === 1) { caja.etapa = 2; mov(caja, 'Etapa 2', t, { just: uno(['Lavado manual + termodesinfectora', 'Lavado ultrasónico', 'Lavado en termodesinfectora N°' + ent(1, 3)]) }); caja.prox = t + entre(1, 2.5) * HORA; }
                else if (caja.etapa === 2 && rnd() < 0.05) { caja.etapa = 3; caja.prox = t + entre(0.5, 2) * HORA; caja.lista = true; }
                else if (caja.etapa === 2) { caja.etapa = 3; mov(caja, 'Etapa 3', t, { just: `Cotejo ${caja.tipo[4]}/${caja.tipo[4]} piezas, empaque ${uno(['papel grado médico', 'contenedor rígido', 'textil de algodón'])}` }); caja.prox = t + entre(0.5, 2) * HORA; caja.lista = true; }
            }

            // Cargas de autoclave cada 2 h por máquina.
            if ((t % (2 * HORA)) === 0) {
                const giro = (t / (2 * HORA)) % 4;
                for (const m of [1, 2, 3, 4].map(x => ((x + giro - 1) % 4) + 1)) {
                    const listas = cajas.filter(k => k.etapa === 3 && k.lista && k.prox <= t && !k.enCarga);
                    if (listas.length === 0) break;
                    const lote = listas.slice(0, ent(3, 8));
                    const op = uno(TENS);
                    const temp = uno([134, 134, 134, 121]);
                    const carga = { id: ++idCarga, m, n: numCiclo[m]++, op, ini: t + entre(0, 0.4) * HORA, temp, pres: temp === 134 ? '2.1 bar' : '1.1 bar', min: temp === 134 ? ent(4, 18) : 20 };
                    carga.fin = carga.ini + entre(1.7, 2.2) * HORA;
                    carga.ok = rnd() > 0.03;
                    carga.lib = uno(ENFERMERAS);
                    carga.obs = carga.ok ? null : uno(CAUSAS_NO_ESTERIL);
                    carga.cajas = lote;
                    cargas.push(carga);
                    audit.push([op, 'crear_ciclo', 'ciclo_esterilizacion', carga.id, JSON.stringify({ carga: `M${m}-C${carga.n}`, cajas: lote.map(k => k.codigo) }), carga.ini]);
                    for (const k of lote) {
                        k.enCarga = carga; k.lista = false; k.etapa = 4;
                        mov(k, 'Etapa 4', carga.ini, { usr: op, just: `Carga M${m}-C${carga.n} en autoclave`, params: ['Autoclave', temp, carga.pres, carga.min], auditar: false });
                        vincT.push([carga.id, k.inv, k.id, 1, carga.ok ? 'Estéril' : 'No estéril', ts(carga.ini)]);
                    }
                }
            }

            // Término de cargas: liberación o reproceso.
            for (const carga of cargas.filter(x => !x.cerrada && x.fin <= t)) {
                carga.cerrada = true;
                audit.push([carga.lib, 'resultado_ciclo', 'ciclo_esterilizacion', carga.id, JSON.stringify({ carga: `M${carga.m}-C${carga.n}`, resultado: carga.ok ? 'Estéril' : 'No estéril', observacion: carga.obs }), carga.fin]);
                for (const k of carga.cajas) {
                    k.enCarga = null;
                    if (carga.ok) {
                        const tAlm = carga.fin + entre(0.2, 1) * HORA;
                        k.etapa = 5; k.caducidad = tAlm + 365 * DIA; k.prox = tAlm;
                        mov(k, 'Etapa 5', tAlm, { just: `Almacenamiento sector ${k.tipo[1].split(' ')[1] || 'general'} — carga M${carga.m}-C${carga.n}`, params: ['Autoclave', carga.temp, carga.pres, carga.min] });
                    } else {
                        k.etapa = 2; k.prox = carga.fin + entre(1, 2) * HORA;
                        mov(k, 'Etapa 2', carga.fin, { usr: carga.lib, just: `Reproceso: carga M${carga.m}-C${carga.n} No estéril (${carga.obs})`.slice(0, 255) });
                    }
                }
            }

            // Solicitudes desde pabellón (menos el fin de semana).
            const h = horaDelDia(t);
            if (h >= 8 && h <= 20 && rnd() < (finde ? 0.4 : 1)) {
                const nSol = finde ? ent(1, 2) : ent(2, 4);
                for (let s = 0; s < nSol; s++) {
                    // La mayoría pide tipos que hay en bodega; a veces piden uno agotado.
                    const conStock = TIPOS.map((_, i) => i + 1).filter(i => cajas.some(k => k.inv === i && k.etapa === 5));
                    const tp = conStock.length && rnd() < 0.9 ? uno(conStock) : ent(1, TIPOS.length);
                    const area = TIPOS[tp - 1][2] === 4 ? uno([13, 13, 6]) : TIPOS[tp - 1][2] === 3 ? uno([12, 12, 10]) : uno(PABELLONES);
                    const sol = { id: ++idSol, tp, area, usr: uno(ENFERMERAS), t: t + entre(0, 0.5) * HORA, tipo: rnd() < 0.3 ? 'Urgencia Médica' : 'Programada', estado: 'Pendiente' };
                    sols.push(sol); pendientesSol.push(sol);
                    dets.push([sol.id, tp, 1]);
                    audit.push([sol.usr, 'crear_solicitud', 'solicitud', sol.id, JSON.stringify({ area_id: area, tipo_cirugia: sol.tipo }), sol.t]);
                }
            }

            // Despacho: TENS entrega una caja estéril del tipo pedido.
            const enCola = pendientesSol.filter(s => s.estado === 'Pendiente' && s.t + (s.tipo === 'Urgencia Médica' ? 0 : 0.5 * HORA) <= t + PASO);
            enCola.sort((x, y) => (y.tipo === 'Urgencia Médica') - (x.tipo === 'Urgencia Médica') || x.t - y.t); // urgencias primero
            for (const sol of enCola) {
                const caja = cajas.find(k => k.inv === sol.tp && k.etapa === 5 && k.prox <= t && !k.enPabellon);
                if (!caja) continue;
                const tDesp = Math.max(t, sol.t) + (sol.tipo === 'Urgencia Médica' ? entre(5, 25) * 60000 : entre(0.2, 1.5) * HORA);
                sol.estado = 'Despachado'; sol.caja = caja.codigo;
                const usr = uno(TENS);
                mov(caja, 'Despachado', tDesp, { usr, area: sol.area, sol: sol.id, just: `Despacho de caja ${caja.codigo} para solicitud REQ-${sol.id}`, auditar: false });
                audit.push([usr, 'despachar_solicitud', 'solicitud', sol.id, JSON.stringify({ caja_codigo: caja.codigo }), tDesp]);
                caja.etapa = 6; caja.enPabellon = true; caja.caducidad = null;
                // Uso en cirugía: se vincula a un paciente y vuelve sucia a Recepción.
                const pac = pacientes.find(p => p.area === sol.area && rnd() < 0.5) || uno(pacientes);
                const tVinc = tDesp + entre(0.5, 2) * HORA;
                const enf = uno(ENFERMERAS);
                if (rnd() < 0.92) vincP.push([caja.id, pac.id, enf, ts(tVinc)]);
                audit.push([enf, 'vinculo_caja_paciente', 'caja_fisica', caja.codigo, JSON.stringify({ paciente_rut: pac.fila[1] }), tVinc]);
                if (rnd() < 0.3) audit.push([enf, 'consulta_ficha_paciente', 'paciente', pac.id, null, tVinc - entre(0.1, 0.4) * HORA]);
                caja.regreso = tVinc + entre(2, 6) * HORA;
            }
            for (const caja of cajas.filter(k => k.enPabellon && k.regreso <= t)) {
                caja.enPabellon = false; caja.etapa = 1; caja.prox = t + entre(0.3, 1) * HORA;
                const faltan = rnd() < 0.06 ? ent(1, 2) : 0;
                mov(caja, 'Etapa 1', t, { just: faltan ? `Recepción con incidencia: faltan ${faltan} pieza(s) (${caja.tipo[4] - faltan}/${caja.tipo[4]})` : `Recepción desde pabellón: caja completa ${caja.tipo[4]}/${caja.tipo[4]} piezas` });
            }
        }
        // Las no despachadas de hace más de 1 día se descartan (en la realidad se cancelan
        // o se resuelven por WhatsApp); las recientes quedan abiertas para el dashboard.
        const viejas = new Set(sols.filter(s => s.estado === 'Pendiente' && s.t < AHORA - DIA).map(s => s.id));
        for (let i = sols.length - 1; i >= 0; i--) if (viejas.has(sols[i].id)) sols.splice(i, 1);
        for (let i = dets.length - 1; i >= 0; i--) if (viejas.has(dets[i][0])) dets.splice(i, 1);
        const abiertas = sols.filter(s => s.estado === 'Pendiente');
        abiertas.forEach((s, i) => { s.estado = i % 3 === 0 ? 'En Preparación' : i % 3 === 1 ? 'Listo' : 'Pendiente'; });
        // Algunas cajas de baja rotación con empaque por vencer o vencido (alertas).
        for (const [tipo, dias] of [['TRA-002', -3], ['MAX-001', 2], ['PED-001', 5], ['CAR-001', 6]]) {
            const k = cajas.find(x => x.tipo[0] === tipo && x.etapa === 5 && !x.vieja) || cajas.find(x => x.etapa === 5 && !x.vieja);
            if (!k || k.enCarga || k.enPabellon) continue;
            const tAlm = AHORA + dias * DIA - 365 * DIA;
            k.vieja = true; k.etapa = 5; k.caducidad = AHORA + dias * DIA;
            hist.push({ inv: k.inv, caja: k.id, ant: 'Etapa 4', nuevo: 'Etapa 5', t: Math.max(tAlm, AHORA - 2 * HORA), area: 3, just: 'Caja de baja rotación: almacenada hace casi 1 año (dato de prueba para alertas)', usr: uno(TENS), sol: null, params: null });
        }
        // Un par de intentos bloqueados por carga No estéril (el control funcionando).
        cargas.filter(x => !x.ok).slice(0, 3).forEach(x => audit.push([uno(TENS), 'etapa_bloqueada', 'caja_fisica', x.cajas[0].codigo, JSON.stringify({ etapa: 5, carga: `M${x.m}-C${x.n}`, estado_carga: 'No estéril' }), x.fin + 0.5 * HORA]));

        // Cargas aún abiertas al final de la simulación quedan En proceso.
        await insertar(c, 'ciclo_esterilizacion',
            ['id', 'operador_id', 'maquina_autoclave', 'numero_maquina', 'numero_ciclo', 'metodo', 'temperatura', 'presion', 'tiempo_minutos', 'fecha_inicio', 'fecha_fin', 'estado', 'observacion', 'liberado_por'],
            cargas.map(x => [x.id, x.op, `Autoclave ${x.m}`, x.m, x.n, 'Autoclave', x.temp, x.pres, x.min, ts(x.ini),
                x.cerrada ? ts(x.fin) : null, x.cerrada ? (x.ok ? 'Estéril' : 'No estéril') : 'En proceso', x.cerrada ? x.obs : null, x.cerrada ? x.lib : null]));
        for (const v of vincT) { const x = cargas[v[0] - 1]; if (!x.cerrada) v[4] = 'Pendiente'; }

        // Inventario: total = cajas físicas del tipo; disponibles = las que están en Almacenamiento.
        const disponibles = (inv) => cajas.filter(k => k.inv === inv && k.etapa === 5).length;
        await insertar(c, 'inventario', ['id', 'categoria_id', 'codigo_barra', 'nombre_equipo', 'cantidad_total', 'cantidad_disponible', 'estado_actual', 'stock_critico'],
            TIPOS.map((tp, i) => {
                const d = disponibles(i + 1);
                const estado = tp[0] === 'ORT-003' ? 'En Reparación' : tp[0] === 'CAR-001' && d === 0 ? 'Merma' : d <= tp[5] ? 'Alerta' : 'Disponible';
                return [i + 1, tp[2], tp[0], tp[1], tp[3], d, estado, tp[5]];
            }));
        await insertar(c, 'caja_fisica', ['id', 'inventario_id', 'codigo_caja', 'estado', 'fecha_creacion', 'fecha_caducidad'],
            cajas.map(k => [k.id, k.inv, k.codigo, 'En circulación', ts(INICIO - 120 * DIA), k.etapa === 5 && k.caducidad ? ts(k.caducidad) : null]));
        await insertar(c, 'solicitud', ['id', 'usuario_id', 'area_id', 'fecha_creacion', 'estado', 'tipo_cirugia', 'observaciones'],
            sols.map(s => [s.id, s.usr, s.area, ts(s.t), s.estado, s.tipo, `[Instrumental Requerido: ${TIPOS[s.tp - 1][1]}]${s.tipo === 'Urgencia Médica' ? ' - Urgencia, prioridad alta' : ''}`]));
        await insertar(c, 'detalle_solicitud', ['solicitud_id', 'inventario_id', 'cantidad_solicitada'], dets);
        hist.sort((a, b) => a.t - b.t);
        await insertar(c, 'historial_movimiento',
            ['inventario_id', 'caja_fisica_id', 'usuario_id', 'estado_anterior', 'estado_nuevo', 'fecha_cambio', 'justificacion', 'solicitud_id', 'area_destino_id', 'metodo_esterilizacion', 'temperatura', 'presion', 'tiempo_minutos'],
            hist.map(h => [h.inv, h.caja, h.usr, h.ant, h.nuevo, ts(h.t), h.just, h.sol, h.area, ...(h.params || [null, null, null, null])]));
        await insertar(c, 'vinculo_trazabilidad', ['ciclo_id', 'inventario_id', 'caja_fisica_id', 'cantidad_procesada', 'resultado', 'fecha'], vincT);
        await insertar(c, 'vinculo_caja_paciente', ['caja_fisica_id', 'paciente_id', 'usuario_id', 'fecha_vinculo'], vincP);
        audit.sort((a, b) => a[5] - b[5]);
        await insertar(c, 'auditoria', ['usuario_id', 'accion', 'entidad', 'entidad_id', 'detalle', 'fecha', 'ip'],
            audit.filter(a => a[5] <= AHORA).map(a => [a[0], a[1], a[2], String(a[3]), a[4], ts(a[5]), `10.20.${ent(1, 4)}.${ent(10, 250)}`]));

        for (const tabla of ['usuario', 'categoria', 'paciente', 'inventario', 'caja_fisica', 'solicitud', 'detalle_solicitud', 'historial_movimiento', 'ciclo_esterilizacion', 'vinculo_trazabilidad', 'vinculo_caja_paciente', 'auditoria']) {
            await c.query(`SELECT setval(pg_get_serial_sequence('${tabla}', 'id'), GREATEST((SELECT MAX(id) FROM ${tabla}), 1))`);
        }
        await c.query('COMMIT');

        const resumen = await c.query(`SELECT
            (SELECT COUNT(*) FROM usuario) usuarios, (SELECT COUNT(*) FROM paciente) pacientes, (SELECT COUNT(*) FROM inventario) tipos_caja,
            (SELECT COUNT(*) FROM caja_fisica) cajas, (SELECT COUNT(*) FROM ciclo_esterilizacion) cargas,
            (SELECT COUNT(*) FROM ciclo_esterilizacion WHERE estado = 'No estéril') cargas_no_esteriles,
            (SELECT COUNT(*) FROM historial_movimiento) movimientos, (SELECT COUNT(*) FROM solicitud) solicitudes,
            (SELECT COUNT(*) FROM vinculo_caja_paciente) vinculos_paciente, (SELECT COUNT(*) FROM auditoria) eventos_auditoria`);
        console.log('Mock cargado en', new URL(URL_DB).host.split('.')[0], `(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
        console.table(resumen.rows[0]);
    } catch (e) {
        await c.query('ROLLBACK').catch(() => {});
        console.error('Error, no se cambió nada:', e);
        process.exitCode = 1;
    } finally {
        c.release();
        await db.end();
    }
})();
