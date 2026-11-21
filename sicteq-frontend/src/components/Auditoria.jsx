import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';

// PB-01: registro de auditoría (quién hizo qué y cuándo). Solo IT.
const ACCIONES = {
  login: 'Inicio de sesión',
  login_fallido: 'Inicio fallido',
  logout: 'Cierre de sesión',
  cambio_etapa: 'Cambio de etapa',
  etapa_bloqueada: 'Avance bloqueado',
  crear_ciclo: 'Registro de carga',
  resultado_ciclo: 'Resultado de carga',
  crear_solicitud: 'Solicitud creada',
  despachar_solicitud: 'Despacho',
  vinculo_caja_paciente: 'Vínculo caja-paciente',
  consulta_ficha_paciente: 'Consulta de ficha',
  despacho_bloqueado: 'Despacho bloqueado',
  cuenta_bloqueada: 'Cuenta bloqueada',
};
const COLOR = { login_fallido: 'bg-danger/15 text-danger', etapa_bloqueada: 'bg-danger/15 text-danger', despacho_bloqueado: 'bg-danger/15 text-danger', cuenta_bloqueada: 'bg-danger/15 text-danger', login: 'bg-ok/15 text-ok' };
const inputCls = 'p-2 border border-border rounded-lg text-sm bg-muted/40 focus:ring-2 focus:ring-primary outline-none';
const fmt = (d) => new Date(d).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const detalleTexto = (d) => (d ? JSON.stringify(d) : '');

// Mismo formato que Reportes.jsx (BOM para que Excel lea bien los tildes).
const downloadCSV = (filename, rows) => {
  const cols = ['fecha', 'usuario', 'rol', 'accion', 'entidad', 'entidad_id', 'detalle', 'ip'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.map(esc).join(','), ...rows.map(r => cols.map(c => esc(c === 'detalle' ? detalleTexto(r.detalle) : c === 'fecha' ? fmt(r.fecha) : r[c])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

function Tarjeta({ icono, color, titulo, valor }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}><i className={`fa-solid ${icono}`}></i></div>
      <div><p className="text-xs text-muted-foreground">{titulo}</p><p className="text-2xl font-bold text-foreground">{valor}</p></div>
    </div>
  );
}

export default function Auditoria() {
  const [filtro, setFiltro] = useState({ accion: '', desde: '', hasta: '' });
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const buscar = useCallback(async (f) => {
    const params = { limite: 1000 };
    if (f.accion) params.accion = f.accion;
    if (f.desde) params.desde = f.desde;
    if (f.hasta) params.hasta = `${f.hasta} 23:59:59`;
    const res = await apiFetch(`/api/auditoria?${new URLSearchParams(params)}`);
    if (res.ok) { setFilas(await res.json()); setError(''); }
    else setError((await res.json().catch(() => ({}))).error || `Error del servidor (${res.status})`);
  }, []);

  useEffect(() => {
    apiFetch('/api/auditoria?limite=1000')
      .then(async r => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).error || `Error del servidor (${r.status})`))))
      .then(setFilas)
      .catch(e => setError(e.message));
  }, []);

  const onBuscar = async () => { setCargando(true); await buscar(filtro); setCargando(false); };
  const contar = (a) => filas.filter(f => f.accion === a).length;

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-bold text-foreground">Registro de Auditoría</h2>
        <p className="text-xs text-muted-foreground">Quién hizo qué y cuándo (Ley 20.584).</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tarjeta icono="fa-list" color="bg-primary/10 text-primary" titulo="Eventos" valor={filas.length} />
        <Tarjeta icono="fa-user-xmark" color="bg-danger/15 text-danger" titulo="Inicios fallidos" valor={contar('login_fallido')} />
        <Tarjeta icono="fa-ban" color="bg-warn/15 text-warn" titulo="Avances bloqueados" valor={contar('etapa_bloqueada')} />
        <Tarjeta icono="fa-id-card" color="bg-primary/15 text-primary" titulo="Consultas de ficha" valor={contar('consulta_ficha_paciente')} />
      </div>

      <div className="bg-card p-4 rounded-lg border border-border flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">Acción
          <select className={inputCls} value={filtro.accion} onChange={(e) => setFiltro({ ...filtro, accion: e.target.value })}>
            <option value="">Todas</option>
            {Object.entries(ACCIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">Desde
          <input type="date" className={inputCls} value={filtro.desde} onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">Hasta
          <input type="date" className={inputCls} value={filtro.hasta} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })} />
        </label>
        <button onClick={onBuscar} disabled={cargando} className="bg-foreground hover:bg-foreground disabled:opacity-60 text-primary-foreground text-sm font-bold px-4 py-2 rounded-lg">{cargando ? 'Buscando...' : 'Buscar'}</button>
        <button onClick={() => downloadCSV(`auditoria_${new Date().toISOString().slice(0, 10)}.csv`, filas)} disabled={filas.length === 0} className="ml-auto bg-ok hover:bg-ok/90 disabled:opacity-50 text-primary-foreground text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2">
          <i className="fa-solid fa-file-csv"></i> Exportar CSV
        </button>
      </div>

      {error && <div className="p-3 rounded-lg text-sm font-medium bg-danger/15 text-danger border border-danger/40">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr><th className="text-left p-3">Fecha y hora</th><th className="text-left p-3">Usuario</th><th className="text-left p-3">Rol</th><th className="text-left p-3">Acción</th><th className="text-left p-3">Entidad</th><th className="text-left p-3">Detalle</th><th className="text-left p-3">IP</th></tr>
          </thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan="7" className="p-6 text-center text-muted-foreground">Sin eventos para estos filtros.</td></tr>}
            {filas.map(f => {
              const det = detalleTexto(f.detalle);
              return (
                <tr key={f.id} className="border-t border-border">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{fmt(f.fecha)}</td>
                  <td className="p-3 font-medium text-foreground">{f.usuario || '—'}</td>
                  <td className="p-3 text-muted-foreground">{f.rol || '—'}</td>
                  <td className="p-3"><span className={`whitespace-nowrap px-2 py-1 rounded-full text-xs font-bold ${COLOR[f.accion] || 'bg-primary/10 text-primary'}`}>{ACCIONES[f.accion] || f.accion}</span></td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{f.entidad} {f.entidad_id}</td>
                  <td className="p-3 text-xs text-muted-foreground max-w-xs truncate" title={det}>{det.length > 80 ? `${det.slice(0, 80)}…` : det}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{f.ip}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
