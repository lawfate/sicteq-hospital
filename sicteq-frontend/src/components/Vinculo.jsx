import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

export default function Vinculo({ user }) {
  // Vínculo caja-paciente (Enfermería, IT). La entrega a pabellón vive en Entrega.jsx.
  const [searchTerm, setSearchTerm] = useState('');
  const [pacientes, setPacientes] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [cajaCode, setCajaCode] = useState('');
  const [vinculoStatus, setVinculoStatus] = useState({ loading: false, message: '', type: '' });

  const loadPacientes = () => {
    apiFetch(`/api/pacientes`)
      .then(res => res.json())
      .then(data => setPacientes(Array.isArray(data) ? data : []))
      .catch(err => console.error("Error al cargar pacientes:", err));
  };

  useEffect(() => {
    loadPacientes();
  }, []);

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

  // Guarda la asociación y actualiza el historial del paciente.
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

  return (
    <div className="space-y-6">

      {/* Vínculo clínico */}
      <div className="space-y-6">

          {/* Sección de pacientes: buscador + listado visible con estado de vínculo */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                      <h3 className="font-bold text-foreground text-lg"><i className="fa-solid fa-users text-primary mr-2"></i>Pacientes</h3>
                      <p className="text-xs text-muted-foreground">Buscá por RUT o nombre, o revisá quién ya tiene una caja vinculada.</p>
                  </div>
                  <input
                      type="text"
                      placeholder="Buscar por RUT o nombre..."
                      className="w-full sm:w-72 p-2.5 border border-border rounded-lg text-sm bg-muted/40 focus:ring-2 focus:ring-primary outline-none"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
              <table className="w-full text-left text-sm text-muted-foreground">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b bg-muted/40">
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
                          <tr key={p.rut} className={`border-b border-border hover:bg-muted/40 transition-colors ${selectedPatient?.rut === p.rut ? 'bg-primary/10' : ''}`}>
                              <td className="whitespace-nowrap px-6 py-3 font-mono text-muted-foreground">{p.rut}</td>
                              <td className="px-6 py-3 font-bold text-foreground">{p.nombre}</td>
                              <td className="px-6 py-3">{p.area_nombre || '—'}</td>
                              <td className="px-6 py-3">
                                  {Number(p.cajas_vinculadas) > 0 ? (
                                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-ok/15 text-ok">Vinculada ({p.cajas_vinculadas})</span>
                                  ) : (
                                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-warn/15 text-warn">Sin vincular</span>
                                  )}
                              </td>
                              <td className="px-6 py-3 text-center">
                                  <button type="button" onClick={() => selectPatient(p.rut)} className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                                      Seleccionar
                                  </button>
                              </td>
                          </tr>
                      ))}
                      {filteredPatients.length === 0 && (
                          <tr>
                              <td colSpan="5" className="px-6 py-8 text-center text-muted-foreground">No se encontró ningún paciente con ese RUT o nombre.</td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* Columna Izquierda: Formulario Vínculo */}
          <div className="rounded-lg border border-border bg-card p-6 space-y-5">
              <div className="border-b border-border pb-3">
                  <h3 className="font-bold text-foreground text-lg"><i className="fa-solid fa-link text-primary mr-2"></i>Asociación Instrumental - Paciente</h3>
                  <p className="text-xs text-muted-foreground">Seleccioná un paciente de la lista de arriba y emparejalo con la caja quirúrgica recepcionada.</p>
              </div>

              {vinculoStatus.message && (
                  <div className={`p-3 rounded-lg text-xs font-medium text-center ${vinculoStatus.type === 'success' ? 'bg-ok/15 text-ok border border-ok/40' : 'bg-danger/15 text-danger border border-danger/40'}`}>
                      {vinculoStatus.message}
                  </div>
              )}

              <form onSubmit={handleVinculoClinico} className="space-y-4">
                  <div className="p-2.5 border border-border rounded-lg text-sm bg-muted/40">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase block">Paciente seleccionado</span>
                      {selectedPatient ? (
                          <span className="font-bold text-foreground">{selectedPatient.nombre} <span className="text-muted-foreground font-mono font-normal">({selectedPatient.rut})</span></span>
                      ) : (
                          <span className="text-muted-foreground italic">Ninguno — seleccioná uno en la tabla de arriba</span>
                      )}
                  </div>

                  <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Código de Caja Utilizada</label>
                      <input
                          type="text"
                          className="p-2.5 border border-border rounded-lg text-sm bg-muted/40 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                          value={cajaCode}
                          onChange={(e) => setCajaCode(e.target.value.toUpperCase())}
                          placeholder="Ej: CAJA-0045"
                      />
                  </div>

                  <button type="submit" disabled={vinculoStatus.loading} className="w-full bg-ok hover:bg-ok/90 disabled:bg-ok text-primary-foreground font-bold py-3 rounded-lg text-xs transition-colors flex items-center justify-center gap-2">
                      {vinculoStatus.loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
                      Confirmar Asociación Clínica
                  </button>
              </form>
          </div>

          {/* Columna Derecha: Ficha Técnica */}
          <div id="patient-chart-box" className="rounded-lg border border-border bg-card p-6 min-h-[340px]">
              {selectedPatient ? (
                  <div className="space-y-4">
                      <div className="flex items-center gap-3 border-b border-border pb-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg"><i className="fa-solid fa-user-injured"></i></div>
                          <div>
                              <h4 className="font-bold text-foreground text-sm">{selectedPatient.nombre}</h4>
                              <p className="text-xs text-muted-foreground font-mono">{selectedPatient.rut}</p>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-muted/40 p-2.5 rounded-lg border border-border">
                              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Ubicación Actual</span>
                              <p className="font-bold text-foreground mt-0.5">{selectedPatient.area_nombre || '—'}</p>
                          </div>
                          <div className="bg-ok/15 p-2.5 rounded-lg border border-ok/40">
                              <span className="text-[10px] uppercase font-bold text-ok block">Alertas IAAS</span>
                              <p className="font-bold text-ok mt-0.5">{selectedPatient.alertas_iaas || 'Ninguna reportada'}</p>
                          </div>
                      </div>
                      <div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Diagnóstico Médico</span>
                          <p className="text-xs text-foreground font-medium bg-muted/40 p-2.5 rounded-lg border border-border mt-1">{selectedPatient.diagnostico}</p>
                      </div>

                      <div className="pt-2 border-t border-border">
                          <h5 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">Historial de Cajas Vinculadas</h5>
                          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-2">
                              {selectedPatient.historial && selectedPatient.historial.length > 0 ? selectedPatient.historial.map((h) => (
                                  <div key={h.id} className="flex justify-between items-center bg-muted/40 p-2 rounded border border-border text-xs font-medium text-foreground">
                                      <span><i className="fa-solid fa-box text-muted-foreground mr-2"></i>{h.codigo_caja} ({h.nombre_equipo})</span>
                                      <span className="text-[10px] text-ok font-bold bg-ok/15 px-2 py-0.5 rounded border border-ok/40">Asociado</span>
                                  </div>
                              )) : <p className="text-muted-foreground italic text-xs">Sin registros recientes.</p>}
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="text-center flex flex-col items-center justify-center h-full text-muted-foreground mt-16">
                      <i className="fa-solid fa-id-card-clip text-5xl mb-4 text-foreground"></i>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Esperando Selección</h4>
                      <p className="text-xs max-w-xs mt-2 mx-auto">Seleccioná un paciente en la tabla de arriba para ver su ficha.</p>
                  </div>
              )}
          </div>
        </div>
        </div>
    </div>
  );
}
