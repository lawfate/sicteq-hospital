import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // <-- NUEVO: Para navegar a la vista de Vínculo
import Modal from './Modal';

const API_URL = import.meta.env.VITE_API_URL;

export default function Dashboard() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', items: [] });
  const [data, setData] = useState({
    stats: { en_proceso: 0, total_equipos: 0, alertas_stock: 0, solicitudes_pendientes: 0 },
    movimientos: [],
    criticas: []
  });

  useEffect(() => {
    fetch(`${API_URL}/api/dashboard`)
      .then(res => res.json())
      .then(json => setData(json))
      .catch(err => console.error("Error cargando dashboard:", err));
  }, []);

  const abrirDetalles = async (mov) => {
    try {
      if (!mov.inventario_id) return;
      const response = await fetch(`${API_URL}/api/dashboard/movimientos/${mov.inventario_id}`);
      const data = await response.json();
      setModalContent({
        title: `Historial: ${mov.justificacion}`,
        items: data
      });
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error al cargar historial:", error);
    }
  };

  // NUEVO: Función para llevar al TENS a vincular la caja
  const handleVincular = (solicitud_id) => {
    // Navegamos a la ruta /vinculo y le pasamos el ID de la solicitud por la URL
    navigate(`/vinculo?solicitud=${solicitud_id}`);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Resumen de Esterilización */}
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
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
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

      {/* SOLICITUDES CRÍTICAS (Actualizado con botón de vincular) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mt-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-white">
          <h3 className="font-bold text-slate-800">Solicitudes Activas de Pabellón Quirúrgico</h3>
        </div>
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="text-xs uppercase tracking-wider text-slate-400 border-b">
            <tr>
              <th className="px-6 py-4">ID Solicitud</th>
              <th className="px-6 py-4">Tipo Cirugía</th>
              <th className="px-6 py-4">Instrumental Requerido</th>
              <th className="px-6 py-4">Pabellón</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4 text-center">Acción</th>
            </tr>
          </thead>
          <tbody>
            {data.criticas.map((critica, idx) => (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-800">REQ-{critica.solicitud_id}</td>
                <td className="px-6 py-4 font-medium">{critica.tipo_cirugia}</td>
                <td className="px-6 py-4 text-xs">{critica.caja_requerida}</td>
                <td className="px-6 py-4 text-slate-500 font-medium">{critica.pabellon}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    critica.estado_actual === 'Pendiente' ? 'bg-blue-100 text-blue-700' :
                    'bg-indigo-100 text-indigo-700'
                  }`}>
                    {critica.estado_actual}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <button 
                    onClick={() => handleVincular(critica.solicitud_id)}
                    className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-2 mx-auto"
                  >
                    <i className="fa-solid fa-link"></i> Vincular
                  </button>
                </td>
              </tr>
            ))}
            {data.criticas.length === 0 && (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                  No hay solicitudes pendientes en este momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* TABLA DE TRAZABILIDAD */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mt-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800">Últimos Movimientos de Trazabilidad</h3>
        </div>
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-white text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3">Folio</th>
              <th className="px-6 py-3">Caja / Instrumental</th>
              <th className="px-6 py-3">Destino</th>
              <th className="px-6 py-3">Estado Actual</th>
              <th className="px-6 py-3 text-center">Acción</th>
            </tr>
          </thead>
          <tbody>
            {data.movimientos.map((mov) => (
              <tr key={mov.id} className="border-b border-slate-100">
                <td className="px-6 py-4 font-bold text-slate-800">{`#FOL-${String(mov.id).padStart(4, '0')}`}</td>
                <td className="px-6 py-4">{mov.justificacion}</td>
                <td className="px-6 py-4">{mov.destino || 'Sin destino'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    mov.estado_nuevo === 'Despachado' ? 'bg-emerald-100 text-emerald-700' :
                    mov.estado_nuevo === 'Alerta Merma' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {mov.estado_nuevo}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <button onClick={() => abrirDetalles(mov)} className="text-slate-400 hover:text-sky-600">
                    <i className="fa-solid fa-eye"></i>
                  </button>
                </td>
              </tr>
            ))}
            {data.movimientos.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                  No hay movimientos registrados aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} content={modalContent} />
    </div>
  );
}