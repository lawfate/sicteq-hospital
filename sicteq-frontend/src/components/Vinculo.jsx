import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL;

export default function Vinculo({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Capturamos si viene un ID de solicitud desde el Dashboard
  const queryParams = new URLSearchParams(location.search);
  const solicitudId = queryParams.get('solicitud');
  
  // Si hay solicitud, estamos en modo "Despacho" (TENS). Si no, en modo "Clínico" (Enfermera)
  const isDespachoMode = Boolean(solicitudId);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [cajaCode, setCajaCode] = useState('');
  const [status, setStatus] = useState({ loading: false, message: '', type: '' });

  // Base de datos simulada de pacientes
  const DB_PACIENTES = [
    { rut: "20.145.892-3", nombre: "Carlos Henríquez Soto", edad: "42 años", pabellón: "Pabellón 3", diagnostico: "Fractura expuesta de fémur", historial: ["BOX-OK-551 (Set Ortopedia)"] },
    { rut: "22.658.114-K", nombre: "María Paz Contreras", edad: "28 años", pabellón: "Pabellón 1", diagnostico: "Cesárea programada", historial: ["BOX-AUT-302 (Set Cesárea)"] },
    { rut: "15.342.789-0", nombre: "Juan Alberto Díaz", edad: "61 años", pabellón: "Pabellón 2", diagnostico: "Colecistectomía", historial: [] }
  ];

  const filteredPatients = searchTerm 
    ? DB_PACIENTES.filter(p => p.rut.includes(searchTerm) || p.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  // LOGICA DE ROLES MEJORADA: 
  const isAuthorized = 
    user?.role === 'IT' || 
    (user?.role === 'Enfermera' && !isDespachoMode) || 
    (user?.role === 'TENS' && isDespachoMode);

  // Acción 1: Vínculo Clínico (Enfermera)
  const handleVinculoClinico = (e) => {
    e.preventDefault();
    if (!selectedPatient) return alert("ERROR: Debe buscar y seleccionar un paciente.");
    if (!cajaCode) return alert("ERROR: Ingrese el código de la caja.");
    alert(`SICTEQ INFORMA:\nAsociación exitosa. La caja "${cajaCode}" quedó vinculada a la ficha clínica de ${selectedPatient.nombre}.`);
  };

  // Acción 2: Despacho de Caja (TENS)
  const handleDespacho = async (e) => {
    e.preventDefault();
    if (!cajaCode) return alert("ERROR: Ingrese el código o folio de la caja a despachar.");
    
    setStatus({ loading: true, message: '', type: '' });

    try {
      const response = await fetch(`${API_URL}/api/solicitudes/${solicitudId}/despachar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caja_codigo: cajaCode, usuario_id: user.id })
      });

      if (!response.ok) throw new Error('Error al despachar la solicitud');

      setStatus({ loading: false, message: '¡Caja despachada con éxito a Pabellón!', type: 'success' });
      
      // Volver al Dashboard después de 2 segundos para ver que desapareció de la lista
      setTimeout(() => navigate('/'), 2000); 

    } catch (error) {
      setStatus({ loading: false, message: error.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Alertas de Éxito o Error del Despacho */}
      {status.message && (
        <div className={`p-4 rounded-lg text-sm font-medium text-center shadow-sm max-w-lg mx-auto ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {status.message}
        </div>
      )}

      {/* Módulo Restringido */}
      {!isAuthorized && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-xl text-center space-y-3 max-w-xl mx-auto">
          <i className="fa-solid fa-lock text-3xl"></i>
          <h3 className="font-bold text-lg">Módulo Restringido</h3>
          <p className="text-sm">Tu perfil ({user?.role}) no cuenta con los privilegios necesarios para acceder a esta vista específica.</p>
        </div>
      )}

      {/* VISTA 1: MODO DESPACHO */}
      {isAuthorized && isDespachoMode && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5 max-w-lg mx-auto">
            <div className="border-b border-slate-100 pb-3 text-center">
                <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center text-xl mx-auto mb-3"><i className="fa-solid fa-truck-medical"></i></div>
                <h3 className="font-bold text-slate-900 text-lg">Despacho de Instrumental</h3>
                <p className="text-xs text-slate-500 mt-1">Asignando caja física a la Solicitud <span className="font-bold text-sky-600">REQ-{solicitudId}</span></p>
            </div>
            
            <form onSubmit={handleDespacho} className="space-y-6">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase text-center">Escanee o Digite el Código de la Caja</label>
                    <input 
                        type="text" 
                        placeholder="Ej: CAJA-LAP-042"
                        className="p-3 border border-slate-300 rounded-lg text-center text-lg bg-slate-50 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-sky-500 uppercase" 
                        value={cajaCode}
                        onChange={(e) => setCajaCode(e.target.value.toUpperCase())}
                    />
                </div>
                
                <div className="flex gap-3">
                  <button type="button" onClick={() => navigate('/')} className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-lg text-xs transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={status.loading} className="w-2/3 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-bold py-3 rounded-lg text-xs transition-colors shadow-md flex items-center justify-center gap-2">
                      {status.loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                      Despachar a Pabellón
                  </button>
                </div>
            </form>
        </div>
      )}

      {/* VISTA 2: MODO VÍNCULO CLÍNICO */}
      {isAuthorized && !isDespachoMode && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Columna Izquierda: Formulario Vínculo */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 text-lg"><i className="fa-solid fa-link text-sky-600 mr-2"></i>Asociación Instrumental - Paciente</h3>
                  <p className="text-xs text-slate-500">Busca un RUT para abrir su historial y emparejar la caja quirúrgica recepcionada.</p>
              </div>
              
              <form onSubmit={handleVinculoClinico} className="space-y-4">
                  <div className="relative">
                      <label className="text-xs font-bold text-slate-500 uppercase">Digite RUN del Paciente</label>
                      <input 
                          type="text" 
                          placeholder="Ej: 20.145..." 
                          className="w-full mt-1 p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-sky-500 outline-none"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      {filteredPatients.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                              {filteredPatients.map(p => (
                                  <button key={p.rut} type="button" onClick={() => { setSelectedPatient(p); setSearchTerm(''); }} className="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 text-xs transition-colors">
                                      <span className="font-bold text-slate-700 block">{p.nombre}</span>
                                      <span className="text-slate-400 font-mono">{p.rut}</span>
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>

                  <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Código de Caja Utilizada</label>
                      <input 
                          type="text" 
                          className="p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-sky-500 uppercase" 
                          value={cajaCode}
                          onChange={(e) => setCajaCode(e.target.value.toUpperCase())}
                      />
                  </div>
                  
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg text-xs transition-colors shadow-md flex items-center justify-center gap-2">
                      <i className="fa-solid fa-floppy-disk"></i> Confirmar Asociación Clínica
                  </button>
              </form>
          </div>

          {/* Columna Derecha: Ficha Técnica */}
          <div id="patient-chart-box" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 min-h-[340px]">
              {selectedPatient ? (
                  <div className="space-y-4">
                      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                          <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-lg"><i className="fa-solid fa-user-injured"></i></div>
                          <div>
                              <h4 className="font-bold text-slate-900 text-sm">{selectedPatient.nombre}</h4>
                              <p className="text-xs text-slate-400 font-mono">{selectedPatient.rut}</p>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Ubicación Actual</span>
                              <p className="font-bold text-slate-700 mt-0.5">{selectedPatient.pabellón}</p>
                          </div>
                          <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                              <span className="text-[10px] uppercase font-bold text-emerald-600 block">Alertas IAAS</span>
                              <p className="font-bold text-emerald-700 mt-0.5">Ninguna reportada</p>
                          </div>
                      </div>
                      <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Diagnóstico Médico</span>
                          <p className="text-xs text-slate-700 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-1">{selectedPatient.diagnostico}</p>
                      </div>
                      
                      <div className="pt-2 border-t border-slate-100">
                          <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Historial de Cajas Vinculadas</h5>
                          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-2">
                              {selectedPatient.historial.length > 0 ? selectedPatient.historial.map((h, i) => (
                                  <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-200 text-xs font-medium text-slate-700">
                                      <span><i className="fa-solid fa-box text-slate-400 mr-2"></i>{h}</span>
                                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">Asociado</span>
                                  </div>
                              )) : <p className="text-slate-400 italic text-xs">Sin registros recientes.</p>}
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="text-center flex flex-col items-center justify-center h-full text-slate-400 mt-16">
                      <i className="fa-solid fa-id-card-clip text-5xl mb-4 text-slate-200"></i>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Esperando Selección</h4>
                      <p className="text-xs max-w-xs mt-2 mx-auto">Digite y seleccione un paciente en el buscador para ver su ficha.</p>
                  </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}