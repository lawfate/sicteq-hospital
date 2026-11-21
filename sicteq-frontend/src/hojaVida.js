import { apiFetch } from './api';
import { nombreEstado } from './etapas';

// Hoja de vida de una caja: todo su recorrido en una página para imprimir o
// guardar como PDF (auditorías, IAAS). Igual que Etiquetas: ventana sin <script>
// (la CSP lo bloquea) y se abre en el mismo clic para que no la frene el navegador.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = (d) => (d ? new Date(d).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const params = (m) => [m.metodo_esterilizacion || m.metodo, m.temperatura && `${m.temperatura} °C`, m.presion, m.tiempo_minutos && `${m.tiempo_minutos} min`].filter(Boolean).join(' · ');
const tabla = (titulo, cabeza, filas, vacio) => `
  <h2>${titulo}</h2>
  ${filas.length ? `<table><thead><tr>${cabeza.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
  <tbody>${filas.map((fila) => `<tr>${fila.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : `<p class="vacio">${vacio}</p>`}`;

export async function imprimirHojaVida(codigo) {
  const w = window.open('', '_blank');
  if (!w) return 'El navegador bloqueó la ventana de impresión. Permita ventanas emergentes para este sitio.';
  w.document.write('<p style="font-family:Arial">Preparando hoja de vida…</p>');
  const r = await apiFetch(`/api/cajas/${encodeURIComponent(codigo)}/hoja-vida`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { w.close(); return d.error || 'No se pudo cargar la hoja de vida.'; }

  const { caja, resumen } = d;
  const quien = (() => { try { return JSON.parse(localStorage.getItem('sicteq_user'))?.name || ''; } catch { return ''; } })();
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Hoja de vida ${esc(caja.codigo_caja)}</title><style>
    @page { margin: 12mm; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 6px; }
    h1 { font: bold 20pt monospace; margin: 0; } h2 { font-size: 11pt; margin: 16px 0 6px; border-bottom: 1px solid #999; }
    .sub { color: #444; } dl { display: grid; grid-template-columns: repeat(4, auto); gap: 2px 16px; margin: 10px 0; }
    dt { color: #555; font-size: 8.5pt; } dd { margin: 0 0 6px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; } th, td { border-bottom: 1px solid #ddd; padding: 3px 4px; text-align: left; vertical-align: top; }
    th { font-size: 8.5pt; color: #444; } tr { break-inside: avoid; } .vacio { color: #666; } footer { margin-top: 18px; font-size: 8pt; color: #555; }
  </style></head><body>
  <header><div><h1>${esc(caja.codigo_caja)}</h1><div class="sub">${esc(caja.tipo)} (${esc(caja.tipo_codigo)})</div></div>
    <div class="sub" style="text-align:right">SICTEQ · Central de Esterilización<br>Hospital Dr. Franco Ravera Zunino</div></header>
  <dl>
    <dt>Estado</dt><dt>Estante</dt><dt>Piezas</dt><dt>Vence el empaque</dt>
    <dd>${esc(caja.estado)}</dd><dd>${esc(caja.estante || '—')}</dd><dd>${esc(caja.piezas ?? '—')}</dd><dd>${f(caja.fecha_caducidad)}</dd>
    <dt>Ciclos completos</dt><dt>Esterilizaciones</dt><dt>Reprocesos</dt><dt>Incidencias</dt>
    <dd>${resumen.ciclos_completos}</dd><dd>${resumen.esterilizaciones}</dd><dd>${resumen.reprocesos}</dd><dd>${resumen.incidencias}</dd>
  </dl>
  ${tabla('Movimientos', ['Fecha', 'Etapa', 'Detalle', 'Registró', 'Parámetros', 'Piezas'],
    d.movimientos.map((m) => [f(m.fecha_cambio), nombreEstado(m.estado_nuevo), m.justificacion || '', m.usuario || '—', params(m), m.piezas_contadas ?? '']), 'Sin movimientos.')}
  ${tabla('Cargas de autoclave', ['Carga', 'Inicio', 'Fin', 'Resultado', 'Parámetros', 'Observación'],
    d.cargas.map((c) => [c.carga, f(c.fecha_inicio), f(c.fecha_fin), c.estado, params(c), c.observacion || '']), 'Sin cargas registradas.')}
  ${tabla('Incidencias de piezas', ['Fecha', 'Contadas', 'Detalle', 'Resolución'],
    d.incidencias.map((i) => [f(i.fecha), `${i.piezas_contadas} de ${i.piezas_esperadas}`, i.detalle || '', i.resolucion ? `${i.resolucion} (${f(i.fecha_resolucion)})` : 'Abierta']), 'Sin incidencias.')}
  ${Array.isArray(d.pacientes) ? tabla('Pacientes con esta caja', ['Fecha', 'RUT', 'Nombre'], d.pacientes.map((p) => [f(p.fecha_vinculo), p.rut, p.nombre]), 'Sin pacientes vinculados.') : ''}
  <footer>Impreso por ${esc(quien)} el ${f(new Date())}. Documento generado por SICTEQ.</footer>
  </body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  return '';
}
