import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

const TABS = [
  { id: 'trazabilidad', label: 'Trazabilidad', icon: 'fa-route' },
  { id: 'solicitudes', label: 'Solicitudes', icon: 'fa-clipboard-list' },
  { id: 'alertas', label: 'Alertas', icon: 'fa-triangle-exclamation' },
  { id: 'vinculos', label: 'Vínculos Clínicos', icon: 'fa-user-injured' }
];

const ESTADOS_SOLICITUD = ['Pendiente', 'En Preparación', 'Listo', 'Despachado'];

const fmt = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const toCSV = (rows, columns) => {
  const header = columns.map(c => `"${c.label}"`).join(',');
  const lines = rows.map(row =>
    columns.map(c => {
      const v = row[c.key];
      const s = v === null || v === undefined ? '' : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [header, ...lines].join('\n');
};

const downloadCSV = (filename, rows, columns) => {
  const csv = toCSV(rows, columns);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

function FilterBar({ children, onApply, loading }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-end gap-3">
      {children}
      <button
        onClick={onApply}
        disabled={loading}
        className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? 'Cargando...' : 'Aplicar filtros'}
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-slate-500 uppercase">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "p-2 border border-slate-300 rounded-lg text-sm";

function ReportTable({ columns, rows, emptyMessage, onExport }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <h3 className="font-bold text-slate-800 text-sm">{rows.length} resultado{rows.length === 1 ? '' : 's'}</h3>
        <button
          onClick={onExport}
          disabled={rows.length === 0}
          className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-2"
        >
          <i className="fa-solid fa-file-csv"></i> Exportar CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600 min-w-[720px]">
          <thead className="text-xs uppercase tracking-wider text-slate-400 border-b bg-white">
            <tr>
              {columns.map(c => <th key={c.key} className="px-6 py-3 whitespace-nowrap">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id ?? idx} className="border-b border-slate-100 hover:bg-slate-50">
                {columns.map(c => (
                  <td key={c.key} className="px-6 py-3 whitespace-nowrap">{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8 text-center text-slate-400">{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReporteTrazabilidad() {
  const [codigo, setCodigo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const columns = [
    { key: 'fecha_cambio', label: 'Fecha', render: r => fmt(r.fecha_cambio) },
    { key: 'codigo_caja', label: 'Caja' },
    { key: 'nombre_equipo', label: 'Instrumental' },
    { key: 'estado_nuevo', label: 'Etapa/Estado' },
    { key: 'destino_nombre', label: 'Destino' },
    { key: 'metodo_esterilizacion', label: 'Método' },
    { key: 'temperatura', label: 'Temp. (°C)' },
    { key: 'presion', label: 'Presión' },
    { key: 'tiempo_minutos', label: 'Tiempo (min)' },
    { key: 'justificacion', label: 'Justificación' }
  ];

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (codigo.trim()) params.set('codigo', codigo.trim().toUpperCase());
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      const res = await fetch(`${API_URL}/api/reportes/trazabilidad?${params.toString()}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error al cargar reporte de trazabilidad:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <FilterBar onApply={load} loading={loading}>
        <Field label="Código de caja">
          <input className={inputCls + ' font-mono uppercase'} placeholder="CAJA-0045" value={codigo} onChange={e => setCodigo(e.target.value)} />
        </Field>
        <Field label="Desde"><input type="date" className={inputCls} value={desde} onChange={e => setDesde(e.target.value)} /></Field>
        <Field label="Hasta"><input type="date" className={inputCls} value={hasta} onChange={e => setHasta(e.target.value)} /></Field>
      </FilterBar>
      <ReportTable
        columns={columns}
        rows={rows}
        emptyMessage="No hay movimientos que coincidan con los filtros."
        onExport={() => downloadCSV('trazabilidad.csv', rows, columns)}
      />
    </div>
  );
}

function ReporteSolicitudes() {
  const [areas, setAreas] = useState([]);
  const [areaId, setAreaId] = useState('');
  const [estado, setEstado] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const columns = [
    { key: 'fecha_creacion', label: 'Fecha', render: r => fmt(r.fecha_creacion) },
    { key: 'area_nombre', label: 'Área' },
    { key: 'tipo_cirugia', label: 'Tipo Cirugía' },
    { key: 'observaciones', label: 'Observaciones' },
    { key: 'estado', label: 'Estado' },
    { key: 'usuario_nombre', label: 'Solicitado por' }
  ];

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (areaId) params.set('area_id', areaId);
      if (estado) params.set('estado', estado);
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      const res = await fetch(`${API_URL}/api/solicitudes?${params.toString()}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error al cargar reporte de solicitudes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch(`${API_URL}/api/solicitudes/areas`)
      .then(res => res.json())
      .then(data => setAreas(Array.isArray(data) ? data : []))
      .catch(err => console.error('Error al cargar áreas:', err));
    load();
  }, []);

  return (
    <div className="space-y-4">
      <FilterBar onApply={load} loading={loading}>
        <Field label="Área">
          <select className={inputCls} value={areaId} onChange={e => setAreaId(e.target.value)}>
            <option value="">Todas</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select className={inputCls} value={estado} onChange={e => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS_SOLICITUD.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </Field>
        <Field label="Desde"><input type="date" className={inputCls} value={desde} onChange={e => setDesde(e.target.value)} /></Field>
        <Field label="Hasta"><input type="date" className={inputCls} value={hasta} onChange={e => setHasta(e.target.value)} /></Field>
      </FilterBar>
      <ReportTable
        columns={columns}
        rows={rows}
        emptyMessage="No hay solicitudes que coincidan con los filtros."
        onExport={() => downloadCSV('solicitudes.csv', rows, columns)}
      />
    </div>
  );
}

function ReporteAlertas() {
  const [stockBajo, setStockBajo] = useState([]);
  const [cajasPorVencer, setCajasPorVencer] = useState([]);
  const [loading, setLoading] = useState(false);

  const colsStock = [
    { key: 'nombre_equipo', label: 'Instrumental' },
    { key: 'codigo_barra', label: 'Código' },
    { key: 'cantidad_disponible', label: 'Disponible' },
    { key: 'cantidad_total', label: 'Total' },
    { key: 'stock_critico', label: 'Crítico' },
    { key: 'estado_actual', label: 'Estado' }
  ];

  const colsVencer = [
    { key: 'codigo_caja', label: 'Caja' },
    { key: 'nombre_equipo', label: 'Instrumental' },
    { key: 'fecha_caducidad', label: 'Caduca', render: r => fmt(r.fecha_caducidad) },
    { key: 'dias_restantes', label: 'Días restantes' }
  ];

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/alertas`);
      const data = await res.json();
      setStockBajo(Array.isArray(data.stockBajo) ? data.stockBajo : []);
      setCajasPorVencer(Array.isArray(data.cajasPorVencer) ? data.cajasPorVencer : []);
    } catch (err) {
      console.error('Error al cargar alertas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={load} disabled={loading} className="text-sm font-bold text-slate-500 hover:text-sky-600 flex items-center gap-2">
          <i className={`fa-solid fa-arrows-rotate ${loading ? 'animate-spin' : ''}`}></i> Actualizar
        </button>
      </div>
      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Stock bajo o en alerta</h4>
        <ReportTable
          columns={colsStock}
          rows={stockBajo}
          emptyMessage="Sin alertas de stock en este momento."
          onExport={() => downloadCSV('alertas-stock.csv', stockBajo, colsStock)}
        />
      </div>
      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Empaque por vencer</h4>
        <ReportTable
          columns={colsVencer}
          rows={cajasPorVencer}
          emptyMessage="Sin cajas próximas a vencer en este momento."
          onExport={() => downloadCSV('alertas-vencimiento.csv', cajasPorVencer, colsVencer)}
        />
      </div>
    </div>
  );
}

function ReporteVinculos() {
  const [rut, setRut] = useState('');
  const [codigo, setCodigo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const columns = [
    { key: 'fecha_vinculo', label: 'Fecha', render: r => fmt(r.fecha_vinculo) },
    { key: 'paciente_nombre', label: 'Paciente' },
    { key: 'rut', label: 'RUT' },
    { key: 'diagnostico', label: 'Diagnóstico' },
    { key: 'alertas_iaas', label: 'Alertas IAAS' },
    { key: 'codigo_caja', label: 'Caja' },
    { key: 'nombre_equipo', label: 'Instrumental' },
    { key: 'vinculado_por', label: 'Vinculado por' }
  ];

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (rut.trim()) params.set('rut', rut.trim());
      if (codigo.trim()) params.set('codigo', codigo.trim().toUpperCase());
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      const res = await fetch(`${API_URL}/api/reportes/vinculos?${params.toString()}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error al cargar reporte de vínculos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <FilterBar onApply={load} loading={loading}>
        <Field label="RUT paciente">
          <input className={inputCls} placeholder="20.145.892-3" value={rut} onChange={e => setRut(e.target.value)} />
        </Field>
        <Field label="Código de caja">
          <input className={inputCls + ' font-mono uppercase'} placeholder="CAJA-0045" value={codigo} onChange={e => setCodigo(e.target.value)} />
        </Field>
        <Field label="Desde"><input type="date" className={inputCls} value={desde} onChange={e => setDesde(e.target.value)} /></Field>
        <Field label="Hasta"><input type="date" className={inputCls} value={hasta} onChange={e => setHasta(e.target.value)} /></Field>
      </FilterBar>
      <ReportTable
        columns={columns}
        rows={rows}
        emptyMessage="No hay vínculos clínicos que coincidan con los filtros."
        onExport={() => downloadCSV('vinculos-clinicos.csv', rows, columns)}
      />
    </div>
  );
}

export default function Reportes() {
  const [tab, setTab] = useState('trazabilidad');

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Reportes de Gestión</h2>
        <p className="text-slate-500 text-sm">Trazabilidad, solicitudes, alertas y vínculos clínicos, filtrables y exportables a CSV.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === t.id ? 'bg-sky-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <i className={`fa-solid ${t.icon}`}></i> {t.label}
          </button>
        ))}
      </div>

      {tab === 'trazabilidad' && <ReporteTrazabilidad />}
      {tab === 'solicitudes' && <ReporteSolicitudes />}
      {tab === 'alertas' && <ReporteAlertas />}
      {tab === 'vinculos' && <ReporteVinculos />}
    </section>
  );
}
