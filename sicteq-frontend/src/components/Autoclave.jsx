import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';

// PB-04: registro de cargas de autoclave. Identificador de la carga =
// N° de autoclave + N° de ciclo (el mismo del voucher de la máquina).
const METODOS = ['Autoclave', 'Óxido de Etileno', 'Plasma de Peróxido de Hidrógeno'];
const PUEDEN_LIBERAR = ['Enfermera', 'IT'];
const FORM_INICIAL = { numero_maquina: '1', numero_ciclo: '', metodo: METODOS[0], temperatura: '', presion: '', tiempo_minutos: '' };

const fmt = (d) => d ? new Date(d).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const idCarga = (c) => `M${c.numero_maquina}-C${c.numero_ciclo}`;
const BADGE = {
  'En proceso': 'bg-amber-100 text-amber-700 border-amber-200',
  'Estéril': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'No estéril': 'bg-red-100 text-red-700 border-red-200',
};
const inputCls = 'p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-sky-500 outline-none';

const leerError = async (res) => (await res.json().catch(() => ({}))).error || `Error del servidor (${res.status})`;

function Aviso({ aviso }) {
  if (!aviso) return null;
  const ok = aviso.tipo === 'ok';
  return (
    <div className={`p-3 rounded-lg text-sm font-medium border ${ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
      <i className={`fa-solid ${ok ? 'fa-circle-check' : 'fa-circle-exclamation'} mr-2`}></i>{aviso.texto}
    </div>
  );
}

export default function Autoclave({ user }) {
  const [form, setForm] = useState(FORM_INICIAL);
  const [codigo, setCodigo] = useState('');
  const [cajas, setCajas] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const [ciclos, setCiclos] = useState([]);
  const [filtro, setFiltro] = useState({ maquina: '', numero: '' });
  const [detalle, setDetalle] = useState(null);
  const [modoNoEsteril, setModoNoEsteril] = useState(false);
  const [observacion, setObservacion] = useState('');
  const [avisoDetalle, setAvisoDetalle] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargarCiclos = useCallback(async (f = { maquina: '', numero: '' }) => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== '')).toString();
    const res = await apiFetch(`/api/ciclos${qs ? `?${qs}` : ''}`);
    if (res.ok) setCiclos(await res.json());
  }, []);

  useEffect(() => {
    apiFetch('/api/ciclos').then(r => (r.ok ? r.json() : [])).then(setCiclos).catch(() => {});
  }, []);

  // El aviso se fija recién cuando llega el detalle, para no mostrar un estado intermedio.
  const abrirDetalle = async (id, avisoFinal = null) => {
    const res = await apiFetch(`/api/ciclos/${id}`);
    setModoNoEsteril(false);
    setObservacion('');
    if (res.ok) { setDetalle(await res.json()); setAvisoDetalle(avisoFinal); }
    else setAvisoDetalle({ tipo: 'error', texto: await leerError(res) });
  };

  // El lector de código de barras USB escribe el código y manda Enter.
  const agregarCaja = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const c = codigo.trim().toUpperCase();
    if (c && !cajas.includes(c)) setCajas([...cajas, c]);
    setCodigo('');
  };

  const registrar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    if (cajas.length === 0) { setAviso({ tipo: 'error', texto: 'Agrega al menos una caja a la carga (escribe o escanea el código y presiona Enter).' }); return; }
    setEnviando(true);
    setAviso(null);
    try {
      const res = await apiFetch('/api/ciclos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, numero_maquina: Number(form.numero_maquina), numero_ciclo: Number(form.numero_ciclo), cajas }),
      });
      if (!res.ok) throw new Error(await leerError(res));
      const data = await res.json();
      setAviso({ tipo: 'ok', texto: `Carga ${data.identificador} registrada con ${cajas.length} caja(s). Queda En proceso hasta que Enfermería registre el resultado.` });
      setForm({ ...FORM_INICIAL, numero_maquina: form.numero_maquina, metodo: form.metodo });
      setCajas([]);
      cargarCiclos(filtro);
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.message });
    } finally {
      setEnviando(false);
    }
  };

  const registrarResultado = async (resultado) => {
    if (resultado === 'No estéril' && !observacion.trim()) {
      setAvisoDetalle({ tipo: 'error', texto: 'Escribe la causa de la carga No estéril.' });
      return;
    }
    if (guardando) return;
    setGuardando(true);
    try {
      const res = await apiFetch(`/api/ciclos/${detalle.id}/resultado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultado, observacion }),
      });
      if (!res.ok) { setAvisoDetalle({ tipo: 'error', texto: await leerError(res) }); return; }
      cargarCiclos(filtro);
      await abrirDetalle(detalle.id, { tipo: 'ok', texto: resultado === 'Estéril' ? 'Carga liberada como Estéril.' : 'Carga marcada No estéril: sus cajas volvieron a Lavado.' });
    } finally {
      setGuardando(false);
    }
  };

  const puedeLiberar = PUEDEN_LIBERAR.includes(user?.role);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900">Cargas de Autoclave</h2>
        <p className="text-xs text-slate-500">Cada carga se identifica por N° de autoclave + N° de ciclo, igual que el voucher. Una carga No estéril bloquea sus cajas hasta un nuevo ciclo Estéril.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Nueva carga */}
        <form onSubmit={registrar} className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 h-fit">
          <h3 className="font-bold text-slate-800"><i className="fa-solid fa-plus text-sky-600 mr-2"></i>Nueva carga</h3>
          <Aviso aviso={aviso} />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500 uppercase">N° de autoclave
              <select className={inputCls} value={form.numero_maquina} onChange={(e) => setForm({ ...form, numero_maquina: e.target.value })}>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>Autoclave {n}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500 uppercase">N° de ciclo
              <input required type="number" min="1" className={inputCls} value={form.numero_ciclo} onChange={(e) => setForm({ ...form, numero_ciclo: e.target.value })} placeholder="145" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-500 uppercase">Método
            <select className={inputCls} value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value })}>
              {METODOS.map(m => <option key={m}>{m}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500 uppercase">Temp. °C
              <input type="number" step="0.1" className={inputCls} value={form.temperatura} onChange={(e) => setForm({ ...form, temperatura: e.target.value })} placeholder="134" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500 uppercase">Presión
              <input className={inputCls} value={form.presion} onChange={(e) => setForm({ ...form, presion: e.target.value })} placeholder="2.1 bar" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500 uppercase">Minutos
              <input type="number" min="1" className={inputCls} value={form.tiempo_minutos} onChange={(e) => setForm({ ...form, tiempo_minutos: e.target.value })} placeholder="18" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-500 uppercase">Código de caja (escanear o escribir + Enter)
            <input className={`${inputCls} font-mono uppercase tracking-wider`} value={codigo} onChange={(e) => setCodigo(e.target.value)} onKeyDown={agregarCaja} placeholder="CAJA-0001" />
          </label>
          <div className="flex flex-wrap gap-2 min-h-8">
            {cajas.length === 0 && <span className="text-xs text-slate-400">Sin cajas agregadas.</span>}
            {cajas.map(c => (
              <span key={c} className="inline-flex items-center gap-2 bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-3 py-1 text-xs font-mono font-bold">
                {c}
                <button type="button" aria-label={`Quitar ${c}`} onClick={() => setCajas(cajas.filter(x => x !== c))} className="text-sky-400 hover:text-red-500"><i className="fa-solid fa-xmark"></i></button>
              </span>
            ))}
          </div>
          <button type="submit" disabled={enviando} className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-bold py-2.5 rounded-lg text-sm shadow-md flex justify-center items-center gap-2">
            {enviando ? <><i className="fa-solid fa-spinner fa-spin"></i> Registrando...</> : <>Registrar carga ({cajas.length} caja{cajas.length === 1 ? '' : 's'})</>}
          </button>
        </form>

        {/* Listado + detalle */}
        <div className="xl:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-end gap-3">
              <h3 className="font-bold text-slate-800 mr-auto"><i className="fa-solid fa-list text-sky-600 mr-2"></i>Cargas registradas</h3>
              <input type="number" min="1" className={`${inputCls} w-28`} placeholder="Autoclave" value={filtro.maquina} onChange={(e) => setFiltro({ ...filtro, maquina: e.target.value })} />
              <input type="number" min="1" className={`${inputCls} w-28`} placeholder="N° ciclo" value={filtro.numero} onChange={(e) => setFiltro({ ...filtro, numero: e.target.value })} />
              <button onClick={() => cargarCiclos(filtro)} className="bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold px-4 py-2 rounded-lg">Buscar</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="text-left p-3">Carga</th><th className="text-left p-3">Método / parámetros</th><th className="p-3">Cajas</th><th className="text-left p-3">Operador</th><th className="text-left p-3">Inicio</th><th className="p-3">Estado</th></tr>
                </thead>
                <tbody>
                  {ciclos.length === 0 && <tr><td colSpan="6" className="p-6 text-center text-slate-400">No hay cargas registradas.</td></tr>}
                  {ciclos.map(c => (
                    <tr key={c.id} onClick={() => abrirDetalle(c.id)} className={`border-t border-slate-100 cursor-pointer hover:bg-sky-50 ${detalle?.id === c.id ? 'bg-sky-50' : ''}`}>
                      <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">{idCarga(c)}</td>
                      <td className="p-3 text-slate-600">{c.metodo}<div className="text-xs text-slate-400">{[c.temperatura && `${c.temperatura} °C`, c.presion, c.tiempo_minutos && `${c.tiempo_minutos} min`].filter(Boolean).join(' · ') || 'sin parámetros'}</div></td>
                      <td className="p-3 text-center font-bold">{c.cantidad_cajas}</td>
                      <td className="p-3 text-slate-600">{c.operador || '—'}</td>
                      <td className="p-3 text-slate-600">{fmt(c.fecha_inicio)}</td>
                      <td className="p-3 text-center"><span className={`whitespace-nowrap px-2 py-1 rounded-full text-xs font-bold border ${BADGE[c.estado] || 'bg-slate-100 text-slate-600'}`}>{c.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {detalle && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg font-mono">{detalle.identificador}</h3>
                  <p className="text-xs text-slate-500">Inicio {fmt(detalle.fecha_inicio)} · Fin {fmt(detalle.fecha_fin)}{detalle.observacion ? ` · Observación: ${detalle.observacion}` : ''}</p>
                </div>
                <span className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold border ${BADGE[detalle.estado] || ''}`}>{detalle.estado}</span>
              </div>
              <Aviso aviso={avisoDetalle} />
              <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
                {detalle.cajas.map(c => (
                  <li key={c.codigo_caja} className="flex justify-between p-3 text-sm">
                    <span><span className="font-mono font-bold">{c.codigo_caja}</span> <span className="text-slate-500">— {c.nombre_equipo}</span></span>
                    <span className="text-xs text-slate-500">{c.resultado}</span>
                  </li>
                ))}
              </ul>

              {detalle.estado === 'En proceso' && (puedeLiberar ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-3">
                    <button disabled={guardando} onClick={() => registrarResultado('Estéril')} className="disabled:opacity-60 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-lg"><i className="fa-solid fa-circle-check mr-2"></i>Liberar como Estéril</button>
                    <button onClick={() => setModoNoEsteril(true)} className="bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-bold px-4 py-2 rounded-lg"><i className="fa-solid fa-triangle-exclamation mr-2"></i>Marcar No estéril</button>
                  </div>
                  {modoNoEsteril && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                      <p className="text-sm text-red-700 font-medium">Las cajas de esta carga vuelven a Lavado y quedan bloqueadas hasta una nueva carga Estéril.</p>
                      <textarea className={`${inputCls} w-full h-20 resize-none bg-white`} value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Causa (obligatoria): ej. Corte de luz durante el ciclo" />
                      <button disabled={guardando} onClick={() => registrarResultado('No estéril')} className="disabled:opacity-60 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded-lg">{guardando ? 'Guardando…' : 'Confirmar No estéril'}</button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3"><i className="fa-solid fa-lock mr-2"></i>Solo Enfermería puede liberar la carga.</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
