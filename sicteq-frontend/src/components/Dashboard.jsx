import React, { useState, useEffect } from 'react';
import Modal from './Modal';

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', items: [] });
  const [data, setData] = useState({
    stats: { en_proceso: 0, total_equipos: 0, alertas_stock: 0, solicitudes_pendientes: 0 },
    movimientos: [],
    criticas: [] // Agregado para que no falle al iniciar
  });

  useEffect(() => {
    fetch('http://localhost:4000/api/dashboard')
      .then(res => res.json())
      .then(json => setData(json))
      .catch(err => console.error("Error cargando dashboard:", err));
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Resumen de Esterilización</h2>
        <p className="text-slate-500 text-sm mt-1">Métricas en tiempo real del ciclo quirúrgico.</p>
      </div>

      {/* TARJETAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Cajas en Proceso', val: data.stats.en_proceso, color: 'blue', icon: 'fa-boxes-stacked' },
          { title: 'Listas / Despachadas', val: data.stats.total_equipos, color: 'emerald', icon: 'fa-check-double' },
          { title: 'Alertas de Merma', val: data.stats.alertas_stock, color: 'amber', icon: 'fa-triangle-exclamation' },
          { title: 'Solicitudes Pabellón', val: data.stats.solicitudes_pendientes, color: 'purple', icon: 'fa-clipboard-list' }
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center gap-4 hover:border-sky-400 transition-all">
            <div className={`w-12 h-12 rounded-full bg-${card.color}-100 flex items-center justify-center text-${card.color}-600 text-xl`}>
              <i className={`fa-solid ${card.icon}`}></i>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">{card.title}</p>
              <p className="text-2xl font-bold text-slate-800">{card.val || 0}</p>
            </div>
          </div>
        ))}
      </div>

      {/* TABLA DE TRAZABILIDAD */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mt-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800">Últimos Movimientos de Trazabilidad</h3>
          <button className="text-sm text-sky-600 font-semibold hover:text-sky-700">Ver todo</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-white text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Folio</th>
                <th className="px-6 py-3">Caja / Instrumental</th>
                <th className="px-6 py-3">Destino</th>
                <th className="px-6 py-3">Estado Actual</th>
                <th className="px-6 py-3">Última Actualización</th>
                <th className="px-6 py-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.movimientos && data.movimientos.length > 0 ? (
                data.movimientos.map((mov) => (
                  <tr key={mov.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {`#FOL-${String(mov.id).padStart(4, '0')}`}
                    </td>
                    <td className="px-6 py-4">{mov.justificacion || 'Sin descripción'}</td>
                    <td className="px-6 py-4 text-slate-500 font-medium">{mov.destino || '-'}</td>
                    <td className="px-6 py-4">
                      {/* LÓGICA DE COLORES DINÁMICOS */}
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        mov.estado_nuevo === 'Despachado' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                        mov.estado_nuevo === 'Alerta Merma' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 
                        mov.estado_nuevo === 'Lavado Clínico' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 
                        'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        {mov.estado_nuevo}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(mov.fecha_cambio)}</td>
                    <td className="px-6 py-4 text-center">
                      <button className="text-slate-400 hover:text-sky-600">
                        <i className="fa-solid fa-eye"></i>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-slate-400">No hay movimientos registrados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SOLICITUDES CRÍTICAS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mt-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-truck-medical text-red-500"></i>
            <h3 className="font-bold text-slate-800">Solicitudes Críticas de Pabellón Quirúrgico</h3>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-500 border border-red-100">
            Urgencias Médicas Activas
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-white text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">ID Cirugía</th>
                <th className="px-6 py-4 font-semibold">Caja Requerida</th>
                <th className="px-6 py-4 font-semibold">Pabellón</th>
                <th className="px-6 py-4 font-semibold">Estado Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.criticas && data.criticas.length > 0 ? (
                data.criticas.map((critica, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">
                      C-{critica.solicitud_id}
                    </td>
                    <td className="px-6 py-4">{critica.caja_requerida}</td>
                    <td className="px-6 py-4 text-slate-500">{critica.pabellon}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        critica.estado_actual === 'Listo' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                        'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        {critica.estado_actual}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-slate-400">No hay solicitudes críticas activas</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}