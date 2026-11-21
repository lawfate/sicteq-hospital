import { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { toCSV } from '../csv';
import { descargarXlsx } from '../xlsx';
import { nombreEstado } from '@/etapas';

const TABS = [
  { id: 'trazabilidad', label: 'Trazabilidad', icon: 'fa-route' },
  { id: 'solicitudes', label: 'Solicitudes', icon: 'fa-clipboard-list' },
  { id: 'alertas', label: 'Alertas', icon: 'fa-triangle-exclamation' },
  { id: 'vinculos', label: 'Vínculos Clínicos', icon: 'fa-user-injured' },
  { id: 'tiempos', label: 'Tiempos por etapa', icon: 'fa-stopwatch' }
];

const ESTADOS_SOLICITUD = ['Pendiente', 'En Preparación', 'Listo', 'Despachado'];

const fmt = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
    <div className="bg-card p-4 rounded-lg border border-border flex flex-wrap items-end gap-3">
      {children}
      <button
        onClick={onApply}
        disabled={loading}
        className="bg-foreground text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold hover:bg-foreground disabled:opacity-50"
      >
        {loading ? 'Cargando...' : 'Aplicar filtros'}
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-muted-foreground uppercase">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "p-2 border border-border rounded-lg text-sm";

// Excel recibe lo mismo que se ve en pantalla (fechas legibles, etapas con nombre).
const legibles = (rows, columns) => rows.map(r => Object.fromEntries(columns.map(c => [c.key, c.render ? c.render(r) : r[c.key]])));

function ReportTable({ columns, rows, emptyMessage, archivo }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/40">
        <h3 className="font-bold text-foreground text-sm">{rows.length} resultado{rows.length === 1 ? '' : 's'}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => descargarXlsx(`${archivo}.xlsx`, legibles(rows, columns), columns)}
            disabled={rows.length === 0}
            className="bg-ok text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-ok/90 disabled:opacity-40 flex items-center gap-2"
          >
            <i className="fa-solid fa-file-excel"></i> Exportar Excel
          </button>
          <button
            onClick={() => downloadCSV(`${archivo}.csv`, rows, columns)}
            disabled={rows.length === 0}
            className="border border-border px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-muted disabled:opacity-40 flex items-center gap-2"
          >
            <i className="fa-solid fa-file-csv"></i> CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-muted-foreground min-w-[720px]">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b bg-card">
            <tr>
              {columns.map(c => <th key={c.key} className="px-6 py-3 whitespace-nowrap">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id ?? idx} className="border-b border-border hover:bg-muted/40">
                {columns.map(c => (
                  <td key={c.key} className="px-6 py-3 whitespace-nowrap">{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8 text-center text-muted-foreground">{emptyMessage}</td>
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
      const res = await apiFetch(`/api/reportes/trazabilidad?${params.toString()}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data.map(row => ({
        ...row,
        estado_nuevo: nombreEstado(row.estado_nuevo)
      })) : []);
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
        archivo="trazabilidad"
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
      const res = await apiFetch(`/api/solicitudes?${params.toString()}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error al cargar reporte de solicitudes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiFetch(`/api/solicitudes/areas`)
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
        archivo="solicitudes"
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
      const res = await apiFetch(`/api/alertas`);
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
        <button onClick={load} disabled={loading} className="text-sm font-bold text-muted-foreground hover:text-primary flex items-center gap-2">
          <i className={`fa-solid fa-arrows-rotate ${loading ? 'animate-spin' : ''}`}></i> Actualizar
        </button>
      </div>
      <div>
        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Stock bajo o en alerta</h4>
        <ReportTable
          columns={colsStock}
          rows={stockBajo}
          emptyMessage="Sin alertas de stock en este momento."
          archivo="alertas-stock"
        />
      </div>
      <div>
        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Empaque por vencer</h4>
        <ReportTable
          columns={colsVencer}
          rows={cajasPorVencer}
          emptyMessage="Sin cajas próximas a vencer en este momento."
          archivo="alertas-vencimiento"
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
      const res = await apiFetch(`/api/reportes/vinculos?${params.toString()}`);
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
        archivo="vinculos-clinicos"
      />
    </div>
  );
}

// 135 -> "2 h 15 min": la Central piensa en horas, no en minutos sueltos.
const duracion = (min) => {
  if (min === null || min === undefined) return '—';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (h >= 48) return `${Math.round(h / 24)} días`;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};

function ReporteTiempos() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const columns = [
    { key: 'estado', label: 'Etapa', render: r => nombreEstado(r.estado) },
    { key: 'veces', label: 'Veces' },
    { key: 'mediana_min', label: 'Tiempo habitual (mediana)', render: r => duracion(r.mediana_min) },
    { key: 'p90_min', label: '9 de cada 10 tardan menos de', render: r => duracion(r.p90_min) },
    { key: 'promedio_min', label: 'Promedio', render: r => duracion(r.promedio_min) },
  ];

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', `${hasta} 23:59:59`);
      const res = await apiFetch(`/api/reportes/tiempos?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo calcular el reporte.');
      setRows(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; load cambia estado tras el await
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Cuánto tiempo pasa una caja en cada etapa antes de pasar a la siguiente. "En pabellón" es desde que se entrega hasta que vuelve a Recepción.</p>
      <FilterBar onApply={load} loading={loading}>
        <Field label="Desde"><input type="date" className={inputCls} value={desde} onChange={e => setDesde(e.target.value)} /></Field>
        <Field label="Hasta"><input type="date" className={inputCls} value={hasta} onChange={e => setHasta(e.target.value)} /></Field>
      </FilterBar>
      {error && <p role="alert" className="rounded-md border border-danger/40 bg-danger/15 p-3 text-sm font-bold text-danger">{error}</p>}
      <ReportTable columns={columns} rows={rows} emptyMessage="No hay movimientos en ese rango." archivo="tiempos-por-etapa" />
    </div>
  );
}

export default function Reportes({ user }) {
  const [tab, setTab] = useState('trazabilidad');
  const tabsPermitidas = TABS.filter(t => t.id !== 'vinculos' || ['Enfermera', 'IT'].includes(user?.role));
  const tabActiva = tabsPermitidas.some(t => t.id === tab) ? tab : tabsPermitidas[0].id;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Reportes de Gestión</h2>
        <p className="text-muted-foreground text-sm">Filtrables por fecha y exportables a Excel o CSV.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabsPermitidas.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              tabActiva === t.id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border border-border hover:bg-muted/40'
            }`}
          >
            <i className={`fa-solid ${t.icon}`}></i> {t.label}
          </button>
        ))}
      </div>

      {tabActiva === 'trazabilidad' && <ReporteTrazabilidad />}
      {tabActiva === 'solicitudes' && <ReporteSolicitudes />}
      {tabActiva === 'alertas' && <ReporteAlertas />}
      {tabActiva === 'vinculos' && <ReporteVinculos />}
      {tabActiva === 'tiempos' && <ReporteTiempos />}
    </section>
  );
}
