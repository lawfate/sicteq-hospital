import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { code39Svg } from '../barcode';

// Un código con caracteres fuera de Code 39 no debe botar la pantalla entera.
const svgSeguro = (codigo, opts) => {
  try { return code39Svg(codigo, opts); } catch { return '<span style="color:#b91c1c;font-size:11px">Código no imprimible</span>'; }
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// PB-06: etiqueta por caja con su código de barras. El lector USB "escribe"
// el código y manda Enter, así que en Ciclo/Autoclave basta con escanearla.
function imprimir(cajas) {
  const etiquetas = cajas.map(c => `
    <div class="et">
      <div class="cab">SICTEQ · Central de Esterilización HFRZ</div>
      ${svgSeguro(c.codigo_caja, { alto: 50, modulo: 1.5 })}
      <div class="cod">${esc(c.codigo_caja)}</div>
      <div class="tipo">${esc(c.nombre_equipo)}</div>
    </div>`).join('');
  const w = window.open('', '_blank');
  if (!w) { alert('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes para este sitio.'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas SICTEQ</title><style>
    @page { margin: 8mm; }
    body { font-family: Arial, sans-serif; margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
    .et { border: 1px dashed #999; padding: 3mm; text-align: center; break-inside: avoid; }
    .et svg { width: 100%; height: 50px; }
    .cab { font-size: 8pt; color: #444; margin-bottom: 2mm; }
    .cod { font: bold 14pt monospace; letter-spacing: 1px; }
    .tipo { font-size: 9pt; color: #333; }
  </style></head><body><div class="grid">${etiquetas}</div></body></html>`);
  w.document.close();
  // Sin <script> en la ventana: la política CSP (script-src 'self') lo bloquearía.
  w.focus();
  w.print();
}

export default function Etiquetas() {
  const [cajas, setCajas] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [sel, setSel] = useState(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/cajas/circulacion')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`Error ${r.status}`)))
      .then(setCajas)
      .catch(e => setError('No se pudieron cargar las cajas: ' + e.message));
  }, []);

  const f = filtro.trim().toUpperCase();
  const visibles = cajas.filter(c => !f || c.codigo_caja.includes(f) || String(c.nombre_equipo).toUpperCase().includes(f));
  const toggle = (codigo) => setSel(prev => {
    const n = new Set(prev);
    n.has(codigo) ? n.delete(codigo) : n.add(codigo);
    return n;
  });
  const todasVisibles = visibles.length > 0 && visibles.every(c => sel.has(c.codigo_caja));
  const toggleTodas = () => setSel(prev => {
    const n = new Set(prev);
    visibles.forEach(c => todasVisibles ? n.delete(c.codigo_caja) : n.add(c.codigo_caja));
    return n;
  });

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Etiquetas de Cajas</h2>
        <p className="text-slate-500 text-sm">Imprima la etiqueta con código de barras de cada caja. Luego basta con escanearla en Ciclo de Trazabilidad o en Cargas de Autoclave.</p>
      </div>

      {error && <p className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">{error}</p>}

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center">
        <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Filtrar por código o tipo de caja"
          className="flex-1 min-w-[200px] p-2 border border-slate-300 rounded-lg text-sm" />
        <span className="text-sm text-slate-500">{sel.size} seleccionada(s)</span>
        <button disabled={sel.size === 0} onClick={() => imprimir(cajas.filter(c => sel.has(c.codigo_caja)))}
          className="bg-sky-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed">
          <i className="fa-solid fa-print mr-2"></i>Imprimir etiquetas
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="p-3 w-10"><input type="checkbox" checked={todasVisibles} onChange={toggleTodas} aria-label="Seleccionar todas las visibles" /></th>
              <th className="p-3 text-left">Código</th>
              <th className="p-3 text-left">Tipo de caja</th>
              <th className="p-3 text-left">Último estado</th>
              <th className="p-3 text-left">Vista previa</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(c => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => toggle(c.codigo_caja)}>
                <td className="p-3"><input type="checkbox" checked={sel.has(c.codigo_caja)} onChange={() => toggle(c.codigo_caja)} onClick={e => e.stopPropagation()} aria-label={`Seleccionar ${c.codigo_caja}`} /></td>
                <td className="p-3 font-mono font-bold">{c.codigo_caja}</td>
                <td className="p-3">{c.nombre_equipo}</td>
                <td className="p-3 text-slate-500">{c.estado_nuevo || 'Sin movimientos'}</td>
                <td className="p-3"><div className="w-40" dangerouslySetInnerHTML={{ __html: svgSeguro(c.codigo_caja, { alto: 28, modulo: 1 }) }} /></td>
              </tr>
            ))}
            {visibles.length === 0 && !error && (
              <tr><td colSpan="5" className="p-6 text-center text-slate-400">No hay cajas que coincidan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
