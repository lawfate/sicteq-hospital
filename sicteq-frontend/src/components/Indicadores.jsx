import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

// KPI del Informe 2 (Tablas 32-33), calculados desde la base de datos.
const ESTADOS = {
  ok: { label: 'Meta cumplida', icon: 'fa-circle-check', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  warn: { label: 'Precaución', icon: 'fa-triangle-exclamation', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  bad: { label: 'Peligro', icon: 'fa-circle-xmark', cls: 'bg-red-50 text-red-700 border-red-200' },
};
// Mayor es mejor (porcentajes) o menor es mejor (minutos), con los rangos de la Tabla 33.
const semaforoMin = (v, meta, peligro) => (v === null || v === undefined ? null : v >= meta ? 'ok' : v >= peligro ? 'warn' : 'bad');
const semaforoMax = (v, meta, peligro) => (v === null || v === undefined ? null : v <= meta ? 'ok' : v <= peligro ? 'warn' : 'bad');
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
const fmtDia = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });

function Kpi({ id, titulo, valor, unidad, meta, estado, detalle }) {
  const e = ESTADOS[estado];
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{id && <span className="text-sky-700 mr-1">{id}</span>}{titulo}</p>
        {e && <span className={`whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-full border ${e.cls}`}><i className={`fa-solid ${e.icon} mr-1`}></i>{e.label}</span>}
      </div>
      <p className="text-3xl font-bold text-slate-900 tabular-nums">{valor ?? '—'}<span className="text-base font-semibold text-slate-500 ml-1">{unidad}</span></p>
      {meta && <p className="text-xs text-slate-500">Meta: {meta}</p>}
      {detalle && <p className="text-xs text-slate-400">{detalle}</p>}
    </div>
  );
}

// Una sola serie: barras finas del color de la app, con tooltip y tabla alternativa.
function DespachosPorDia({ datos }) {
  const [hover, setHover] = useState(null);
  if (!datos.length) return <p className="text-sm text-slate-400 p-4">Sin despachos en el periodo.</p>;
  const max = Math.max(...datos.map(d => d.despachos));
  const tope = Math.ceil(max / 10) * 10 || 10;
  const cadaN = Math.ceil(datos.length / 8);
  const total = datos.reduce((a, d) => a + d.despachos, 0);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-bold text-slate-800">Despachos a pabellón por día</h3>
        <span className="text-xs text-slate-500">{total} en total · promedio {Math.round(total / datos.length)} por día</span>
      </div>
      <div className="relative">
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-slate-200"><span className="absolute -top-2 left-0 bg-white pr-1 text-[10px] text-slate-400">{tope}</span></div>
        <div className="flex items-end gap-[2px] h-44 pt-3 border-b border-slate-300" role="img" aria-label={`Despachos por día, máximo ${max}`}>
          {datos.map((d, i) => (
            <div key={d.dia} className="flex-1 h-full flex items-end relative" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div className={`w-full max-w-[22px] rounded-t-[4px] ${hover === i ? 'bg-sky-700' : 'bg-sky-600'}`} style={{ height: `${(d.despachos / tope) * 100}%` }}></div>
              {hover === i && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs rounded-md px-2 py-1 whitespace-nowrap z-10 pointer-events-none">
                  {fmtDia(d.dia)}: <b>{d.despachos}</b> despachos
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-[2px] mt-1">
          {datos.map((d, i) => <div key={d.dia} className="flex-1 text-center text-[10px] text-slate-400">{i % cadaN === 0 ? fmtDia(d.dia) : ''}</div>)}
        </div>
      </div>
      <details className="mt-3 text-xs text-slate-500">
        <summary className="cursor-pointer">Ver como tabla</summary>
        <table className="mt-2 w-full max-w-xs">
          <tbody>{datos.map(d => <tr key={d.dia} className="border-t border-slate-100"><td className="py-1">{fmtDia(d.dia)}</td><td className="py-1 text-right tabular-nums">{d.despachos}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}

export default function Indicadores() {
  const [dias, setDias] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/api/indicadores?dias=${dias}`)
      .then(async r => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).error || `Error del servidor (${r.status})`))))
      .then(d => { setData(d); setError(''); })
      .catch(e => setError(e.message));
  }, [dias]);

  const cambiarPeriodo = (d) => { setData(null); setDias(d); };

  const urg = data?.k3.find(x => x.tipo === 'Urgencia Médica');
  const prog = data?.k3.find(x => x.tipo === 'Programada');
  const k2 = data && pct(data.k2.completos, data.k2.ciclos);
  const k6 = data && pct(data.k6.vinculados, data.k6.despachos);
  const totalCargas = data?.cargas.reduce((a, c) => a + c.cargas, 0) || 0;
  const noEst = data?.cargas.reduce((a, c) => a + c.no_esteriles, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Indicadores de Gestión</h2>
          <p className="text-xs text-slate-500">KPI comprometidos en el Informe 2, calculados con los registros del sistema.</p>
        </div>
        <div className="flex bg-white border border-slate-200 rounded-lg p-1 text-sm font-semibold" role="group" aria-label="Periodo">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => cambiarPeriodo(d)} aria-pressed={dias === d} className={`px-3 py-1.5 rounded-md ${dias === d ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{d} días</button>
          ))}
        </div>
      </div>

      {error && <div className="p-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">{error}</div>}
      {!data && !error && <div className="text-sm text-slate-400"><i className="fa-solid fa-spinner fa-spin mr-2"></i>Calculando indicadores…</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi id="K2" titulo="Trazabilidad completa" valor={k2} unidad="%" meta="≥ 95%" estado={semaforoMin(k2, 95, 80)}
              detalle={`${data.k2.completos} de ${data.k2.ciclos} ciclos con las etapas 1-5 y responsable`} />
            <Kpi id="K3" titulo="Respuesta a urgencias" valor={urg?.promedio_min} unidad="min" meta="≤ 30 min" estado={semaforoMax(urg?.promedio_min, 30, 60)}
              detalle={urg ? `${urg.n} urgencias · p90 ${urg.p90_min} min · programadas: ${prog?.promedio_min ?? '—'} min promedio` : 'Sin urgencias en el periodo'} />
            <Kpi id="K6" titulo="Cirugías con caja vinculada" valor={k6} unidad="%" meta="≥ 90%" estado={semaforoMin(k6, 90, 70)}
              detalle={`${data.k6.vinculados} de ${data.k6.despachos} despachos vinculados a un paciente`} />
            <Kpi id="K5" titulo="Empaques vencidos en bodega" valor={data.k5.vencidas} unidad="cajas" meta="0 vencidas"
              estado={data.k5.vencidas > 0 ? 'bad' : data.k5.por_vencer > 0 ? 'warn' : 'ok'}
              detalle={`${data.k5.por_vencer} por vencer en 7 días · ${data.k5.almacenadas} cajas almacenadas hoy (aproximación de K5)`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Kpi titulo="Cargas No estériles" valor={pct(noEst, totalCargas)} unidad="%" detalle={`${noEst} de ${totalCargas} cargas de autoclave`} />
            <Kpi titulo="Tiempo de reproceso" valor={data.tiempo_ciclo_horas} unidad="h" detalle="Promedio de Recepción a Almacenamiento" />
            <Kpi titulo="Reprocesos e incidencias" valor={data.reprocesos.reprocesos} unidad="reprocesos" detalle={`${data.reprocesos.incidencias_recepcion} recepciones con piezas faltantes`} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <DespachosPorDia datos={data.despachos_por_dia} />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-3">Cargas por autoclave</h3>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500"><tr><th className="text-left pb-2">Autoclave</th><th className="text-right pb-2">Cargas</th><th className="text-right pb-2">Cajas</th><th className="text-right pb-2">No estériles</th></tr></thead>
                <tbody>
                  {data.cargas.map(c => (
                    <tr key={c.autoclave} className="border-t border-slate-100">
                      <td className="py-2 font-medium text-slate-800">Autoclave {c.autoclave}</td>
                      <td className="py-2 text-right tabular-nums">{c.cargas}</td>
                      <td className="py-2 text-right tabular-nums">{c.cajas}</td>
                      <td className="py-2 text-right tabular-nums">{c.no_esteriles > 0 ? <span className="text-red-700 font-bold"><i className="fa-solid fa-triangle-exclamation mr-1"></i>{c.no_esteriles}</span> : 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 space-y-1">
            <p className="font-bold text-slate-600"><i className="fa-solid fa-circle-info mr-1"></i>Indicadores con medición externa</p>
            <p><b>K1</b> tiempo de búsqueda de cajas: requiere registrar las búsquedas en bodega (pendiente). <b>K7</b> disponibilidad: monitor externo del SLA. <b>K8</b> carga del dashboard: medido en el navegador (1,4 s el 05-10-2026). <b>K4</b> se mide en la marcha blanca (motivo "apertura sin uso").</p>
          </div>
        </>
      )}
    </div>
  );
}
