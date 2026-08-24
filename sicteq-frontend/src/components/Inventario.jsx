import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

export default function Inventario() {
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/inventario`)
      .then(res => res.json())
      .then(data => setStockData(Array.isArray(data) ? data : []))
      .catch(err => console.error("Error al cargar inventario:", err))
      .finally(() => setLoading(false));
  }, []);

  const estadoColor = (item) => {
    if (item.estado_actual === 'Alerta' || item.cantidad_disponible <= item.stock_critico) return 'red';
    if (item.estado_actual === 'Sucio') return 'amber';
    return 'emerald';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-400 uppercase text-xs font-semibold border-b border-slate-200">
            <th className="p-4">Nombre de la Caja</th>
            <th className="p-4">Código</th>
            <th className="p-4">Disponible / Total</th>
            <th className="p-4">Estado Stock</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {stockData.map((item) => {
            const color = estadoColor(item);
            return (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-semibold text-slate-700">{item.nombre_equipo}</td>
                <td className="p-4 font-mono text-xs text-slate-500">{item.codigo_barra || '—'}</td>
                <td className="p-4 font-mono">{item.cantidad_disponible} / {item.cantidad_total}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full bg-${color}-100 text-${color}-700`}>
                    {item.estado_actual || 'Sin estado'}
                  </span>
                </td>
              </tr>
            );
          })}
          {!loading && stockData.length === 0 && (
            <tr>
              <td colSpan="4" className="p-8 text-center text-slate-400">No hay inventario registrado.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
