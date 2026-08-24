import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

export default function Vinculo({ user }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Capturamos si viene un ID de solicitud desde el Dashboard
  const queryParams = new URLSearchParams(location.search);
  const solicitudId = queryParams.get('solicitud');

  // Si hay solicitud, estamos en modo "Despacho" (TENS). Si no, en modo "Clínico" (Enfermera)
  const isDespachoMode = Boolean(solicitudId);

  const [searchTerm, setSearchTerm] = useState('');
  const [pacientes, setPacientes] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [cajaCode, setCajaCode] = useState('');
  const [status, setStatus] = useState({ loading: false, message: '', type: '' });
  const [vinculoStatus, setVinculoStatus] = useState({ loading: false, message: '', type: '' });

  // LOGICA DE ROLES MEJORADA:
  const isAuthorized =
    user?.role === 'IT' ||
    (user?.role === 'Enfermera' && !isDespachoMode) ||
    (user?.role === 'TENS' && isDespachoMode);

  const loadPacientes = () => {
    apiFetch(`/api/pacientes`)
      .then(res => res.json())
      .then(data => setPacientes(Array.isArray(data) ? data : []))
      .catch(err => console.error("Error al cargar pacientes:", err));
  };

  useEffect(() => {
    if (isAuthorized && !isDespachoMode) {
      loadPacientes();
    }
  }, [isAuthorized, isDespachoMode]);

  // Sin texto de búsqueda mostramos todos los pacientes (para poder verlos,
  // no solo encontrarlos escribiendo); con texto, filtramos por RUT o nombre.
  const filteredPatients = searchTerm
    ? pacientes.filter(p => p.rut.includes(searchTerm) || p.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
    : pacientes;

  // Trae la ficha completa (con historial real de cajas vinculadas) al seleccionar.
  const selectPatient = async (rut) => {
    try {
      const response = await apiFetch(`/api/pacientes/${encodeURIComponent(rut)}`);
      if (!response.ok) throw new Error('No se pudo cargar la ficha del paciente');
      const data = await response.json();
      setSelectedPatient(data);
    } catch (err) {
      console.error("Error al cargar ficha del paciente:", err);
    }
  };

  // Acción 1: Vínculo Clínico (Enfermera) — ahora persiste de verdad, ya no es un alert()
  const handleVinculoClinico = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return alert("ERROR: Debe buscar y seleccionar un paciente.");
    if (!cajaCode) return alert("ERROR: Ingrese el código de la caja.");

    setVinculoStatus({ loading: true, message: '', type: '' });

    try {
      const response = await apiFetch(`/api/vinculos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut: selectedPatient.rut, codigo_caja: cajaCode, usuario_id: user.id })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Error al registrar el vínculo');

      setVinculoStatus({ loading: false, message: data.message || 'Asociación exitosa.', type: 'success' });
      setCajaCode('');

      // Refrescamos la ficha del paciente (nuevo item en el historial) y la lista
      // general (para que se actualice el contador "Vinculada (N)").
      selectPatient(selectedPatient.rut);
      loadPacientes();

      setTimeout(() => setVinculoStatus({ loading: false, message: '', type: '' }), 4000);
    } catch (error) {
      setVinculoStatus({ loading: false, message: error.message, type: 'error' });
    }
  };

  // Acción 2: Despacho de Caja (TENS)
  const handleDespacho = async (e) => {
    e.preventDefault();
    if (!cajaCode) return alert("ERROR: Ingrese el código o folio de la caja a despachar.");

    setStatus({ loading: true, message: '', type: '' });

    try {
      const response = await apiFetch(`/api/solicitudes/${solicitudId}/despachar`, {
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
        <div className="space-y-6">

          {/* Sección de pacientes: buscador + listado visible con estado de vínculo */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                      <h3 className="font-bold text-slate-900 text-lg"><i className="fa-solid fa-users text-sky-600 mr-2"></i>Pacientes</h3>
                      <p className="text-xs text-slate-500">Buscá por RUT o nombre, o revisá quién ya tiene una caja vinculada.</p>
                  </div>
                  <input
                      type="text"
                      placeholder="Buscar por RUT o nombre..."
                      className="w-full sm:w-72 p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-sky-500 outline-none"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
              <table className="w-full text-left text-sm text-slate-600">
                  <thead className="text-xs uppercase tracking-wider text-slate-400 border-b bg-slate-50">
                      <tr>
                          <th className="px-6 py-3">RUT</th>
                          <th className="px-6 py-3">Nombre</th>
                          <th className="px-6 py-3">Pabellón</th>
                          <th className="px-6 py-3">Caja Vinculada</th>
                          <th className="px-6 py-3 text-center">Acción</th>
                      </tr>
                  </thead>
                  <tbody>
                      {filteredPatients.map(p => (
                          <tr key={p.rut} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedPatient?.rut === p.rut ? 'bg-sky-50' : ''}`}>
                              <td className="px-6 py-3 font-mono text-slate-500">{p.rut}</td>
                              <td className="px-6 py-3 font-bold text-slate-800">{p.nombre}</td>
                              <td className="px-6 py-3">{p.area_nombre || '—'}</td>
                              <td className="px-6 py-3">
                                  {Number(p.cajas_vinculadas) > 0 ? (
                                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Vinculada ({p.cajas_vinculadas})</span>
                                  ) : (
                                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Sin vincular</span>
                                  )}
                              </td>
                              <td className="px-6 py-3 text-center">
                                  <button type="button" onClick={() => selectPatient(p.rut)} className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                                      Seleccionar
                                  </button>
                              </td>
                          </tr>
                      ))}
                      {filteredPatients.length === 0 && (
                          <tr>
                              <td colSpan="5" className="px-6 py-8 text-center text-slate-400">No se encontró ningún paciente con ese RUT o nombre.</td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* Columna Izquierda: Formulario Vínculo */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 text-lg"><i className="fa-solid fa-link text-sky-600 mr-2"></i>Asociación Instrumental - Paciente</h3>
                  <p className="text-xs text-slate-500">Seleccioná un paciente de la lista de arriba y emparejalo con la caja quirúrgica recepcionada.</p>
              </div>

              {vinculoStatus.message && (
                  <div className={`p-3 rounded-lg text-xs font-medium text-center ${vinculoStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                      {vinculoStatus.message}
                  </div>
              )}

              <form onSubmit={handleVinculoClinico} className="space-y-4">
                  <div className="p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Paciente seleccionado</span>
                      {selectedPatient ? (
                          <span className="font-bold text-slate-800">{selectedPatient.nombre} <span className="text-slate-400 font-mono font-normal">({selectedPatient.rut})</span></span>
                      ) : (
                          <span className="text-slate-400 italic">Ninguno — seleccioná uno en la tabla de arriba</span>
                      )}
                  </div>

                  <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Código de Caja Utilizada</label>
                      <input
                          type="text"
                          className="p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-sky-500 uppercase"
                          value={cajaCode}
                          onChange={(e) => setCajaCode(e.target.value.toUpperCase())}
                          placeholder="Ej: CAJA-0045"
                      />
                  </div>

                  <button type="submit" disabled={vinculoStatus.loading} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold py-3 rounded-lg text-xs transition-colors shadow-md flex items-center justify-center gap-2">
                      {vinculoStatus.loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
                      Confirmar Asociación Clínica
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
                              <p className="font-bold text-slate-700 mt-0.5">{selectedPatient.area_nombre || '—'}</p>
                          </div>
                          <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                              <span className="text-[10px] uppercase font-bold text-emerald-600 block">Alertas IAAS</span>
                              <p className="font-bold text-emerald-700 mt-0.5">{selectedPatient.alertas_iaas || 'Ninguna reportada'}</p>
                          </div>
                      </div>
                      <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Diagnóstico Médico</span>
                          <p className="text-xs text-slate-700 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-1">{selectedPatient.diagnostico}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                          <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Historial de Cajas Vinculadas</h5>
                          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-2">
                              {selectedPatient.historial && selectedPatient.historial.length > 0 ? selectedPatient.historial.map((h) => (
                                  <div key={h.id} className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-200 text-xs font-medium text-slate-700">
                                      <span><i className="fa-solid fa-box text-slate-400 mr-2"></i>{h.codigo_caja} ({h.nombre_equipo})</span>
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
                      <p className="text-xs max-w-xs mt-2 mx-auto">Seleccioná un paciente en la tabla de arriba para ver su ficha.</p>
                  </div>
              )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
