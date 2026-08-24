import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // <-- NUEVO: Para navegar a la vista de Vínculo
import Modal from './Modal';
import { apiFetch } from '../api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', items: [] });
  const [data, setData] = useState({
    stats: { en_proceso: 0, total_equipos: 0, alertas_stock: 0, solicitudes_pendientes: 0 },
    movimientos: [],
    criticas: []
  });
  const [cajasCirculacion, setCajasCirculacion] = useState([]);
  const [showCajasCirculacion, setShowCajasCirculacion] = useState(false);
  const [alertas, setAlertas] = useState({ stockBajo: [], cajasPorVencer: [] });

  useEffect(() => {
    apiFetch(`/api/dashboard`)
      .then(res => res.json())
      .then(json => setData(json))
      .catch(err => console.error("Error cargando dashboard:", err));

    apiFetch(`/api/cajas/circulacion`)
      .then(res => res.json())
      .then(json => setCajasCirculacion(Array.isArray(json) ? json : []))
      .catch(err => console.error("Error cargando cajas en circulación:", err));

    apiFetch(`/api/alertas`)
      .then(res => res.json())
      .then(json => setAlertas({
        stockBajo: Array.isArray(json.stockBajo) ? json.stockBajo : [],
        cajasPorVencer: Array.isArray(json.cajasPorVencer) ? json.cajasPorVencer : []
      }))
      .catch(err => console.error("Error cargando alertas:", err));
  }, []);

  const abrirDetalles = async (mov) => {
    try {
      if (!mov.inventario_id) {
        setModalContent({
          title: `Historial: ${mov.justificacion}`,
          items: [],
          emptyMessage: 'Este movimiento no tiene una caja de inventario asociada, así que no hay historial adicional que mostrar.'
        });
        setIsModalOpen(true);
        return;
      }
      const response = await apiFetch(`/api/dashboard/movimientos/${mov.inventario_id}`);
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

      {/* ALERTAS PROACTIVAS: antes había que entrar a Inventario a mirar */}
      {(alertas.stockBajo.length > 0 || alertas.cajasPorVencer.length > 0) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-amber-600"></i>
              <h3 className="font-bold text-slate-800 text-sm">Stock bajo o en alerta <span className="text-slate-400 font-normal">({alertas.stockBajo.length})</span></h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {alertas.stockBajo.map(item => (
                <div key={item.id} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-slate-700">{item.nombre_equipo}</p>
                    <p className="text-xs text-slate-400 font-mono">{item.codigo_barra || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-slate-700">{item.cantidad_disponible} / {item.cantidad_total ?? '—'}</p>
                    <span className="text-xs font-semibold text-amber-700">{item.estado_actual || 'Bajo crítico'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-rose-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-rose-100 bg-rose-50 flex items-center gap-2">
              <i className="fa-solid fa-hourglass-end text-rose-600"></i>
              <h3 className="font-bold text-slate-800 text-sm">Empaque por vencer <span className="text-slate-400 font-normal">({alertas.cajasPorVencer.length})</span></h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {alertas.cajasPorVencer.map(caja => (
                <div key={caja.id} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-slate-700 font-mono">{caja.codigo_caja}</p>
                    <p className="text-xs text-slate-400">{caja.nombre_equipo}</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${caja.dias_restantes < 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                    {caja.dias_restantes < 0 ? `Vencida hace ${Math.abs(caja.dias_restantes)}d` : `Vence en ${caja.dias_restantes}d`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 flex items-center gap-3 text-sm text-emerald-700">
          <i className="fa-solid fa-circle-check"></i>
          Sin alertas de stock ni de vencimiento de empaque en este momento.
        </div>
      )}

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

      {/* CAJAS FÍSICAS EN CIRCULACIÓN (colapsable) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mt-6 overflow-hidden">
        <button
          onClick={() => setShowCajasCirculacion(prev => !prev)}
          className="w-full px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
        >
          <div>
            <h3 className="font-bold text-slate-800">Cajas en Circulación <span className="text-slate-400 font-normal">({cajasCirculacion.length})</span></h3>
            <p className="text-xs text-slate-500 mt-0.5">Unidades físicas individuales con movimientos activos, antes de su eliminación.</p>
          </div>
          <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform ${showCajasCirculacion ? 'rotate-180' : ''}`}></i>
        </button>
        {showCajasCirculacion && (
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs uppercase tracking-wider text-slate-400 border-b">
              <tr>
                <th className="px-6 py-4">Código de Caja</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Destino Actual</th>
                <th className="px-6 py-4">Última Actualización</th>
                <th className="px-6 py-4">Estado</th>
              </tr>
            </thead>
            <tbody>
              {cajasCirculacion.map((caja) => (
                <tr key={caja.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-800 font-mono">{caja.codigo_caja}</td>
                  <td className="px-6 py-4">{caja.nombre_equipo}</td>
                  <td className="px-6 py-4 text-slate-500">{caja.destino_nombre || 'Sin destino'}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{caja.ultima_actualizacion ? formatDate(caja.ultima_actualizacion) : '—'}</td>
                  <td className="px-6 py-4">
                    {caja.estado_nuevo ? (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        caja.estado_nuevo === 'Despachado' ? 'bg-emerald-100 text-emerald-700' :
                        caja.estado_nuevo === 'Alerta Merma' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {caja.estado_nuevo}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                        Sin movimientos aún
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {cajasCirculacion.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                    No hay cajas físicas registradas en circulación.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
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
              <th className="px-6 py-3">Fecha</th>
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
                <td className="px-6 py-4 text-xs text-slate-500">{mov.fecha_cambio ? formatDate(mov.fecha_cambio) : '—'}</td>
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
                <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
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