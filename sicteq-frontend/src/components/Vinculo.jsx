import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../api';

export default function Vinculo({ user }) {
  // Vínculo caja-paciente (Enfermería, IT). La entrega a pabellón vive en Entrega.jsx.
  const [searchTerm, setSearchTerm] = useState('');
  const [pacientes, setPacientes] = useState([]);
  const [listaAbierta, setListaAbierta] = useState(false);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const campoCaja = useRef(null);
  const solicitudFicha = useRef(0);
  const [cargandoFicha, setCargandoFicha] = useState(false);
  const [errorPacientes, setErrorPacientes] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [cajaCode, setCajaCode] = useState('');
  const [vinculoStatus, setVinculoStatus] = useState({ loading: false, message: '', type: '' });

  const loadPacientes = () => {
    apiFetch(`/api/pacientes`)
      .then(res => { if (!res.ok) throw new Error('No se pudo cargar la lista de pacientes.'); return res.json(); })
      .then(data => { setPacientes(Array.isArray(data) ? data : []); setErrorPacientes(''); })
      .catch(err => setErrorPacientes(err.message));
  };

  useEffect(() => {
    loadPacientes();
  }, []);

  // La búsqueda siempre considera la lista completa, aunque solo se vean ocho.
  const busqueda = searchTerm.trim().toLocaleLowerCase('es-CL');
  const filteredPatients = busqueda
    ? pacientes.filter(p => p.rut.toLowerCase().includes(busqueda) || p.nombre.toLocaleLowerCase('es-CL').includes(busqueda))
    : pacientes;
  const pacientesVisibles = mostrarTodos ? filteredPatients : filteredPatients.slice(0, 8);
  const verResultados = () => {
    setListaAbierta(true);
    requestAnimationFrame(() => document.getElementById('pacientes-registrados')?.scrollIntoView({ behavior: 'auto', block: 'start' }));
  };

  // Trae la ficha completa (con historial real de cajas vinculadas) al seleccionar.
  const selectPatient = async (rut, refrescar = false) => {
    const solicitud = ++solicitudFicha.current;
    setCargandoFicha(true);
    if (!refrescar) {
      setSelectedPatient(null);
      setCajaCode('');
      setVinculoStatus({ loading: false, message: '', type: '' });
    }
    try {
      const response = await apiFetch(`/api/pacientes/${encodeURIComponent(rut)}`);
      if (!response.ok) throw new Error('No se pudo cargar la ficha del paciente');
      const data = await response.json();
      if (solicitud !== solicitudFicha.current) return;
      setSelectedPatient(data);
      if (!refrescar) {
        setListaAbierta(false);
        requestAnimationFrame(() => { campoCaja.current?.focus({ preventScroll: true }); campoCaja.current?.closest('form')?.scrollIntoView({ behavior: 'auto', block: 'center' }); });
      }
    } catch (err) {
      if (solicitud === solicitudFicha.current) setVinculoStatus({ loading: false, message: err.message, type: 'error' });
    } finally {
      if (solicitud === solicitudFicha.current) setCargandoFicha(false);
    }
  };

  // Guarda la asociación y actualiza el historial del paciente.
  const handleVinculoClinico = async (e) => {
    e.preventDefault();
    if (vinculoStatus.loading) return;
    if (!selectedPatient || !cajaCode.trim()) return setVinculoStatus({ loading: false, message: 'Seleccione un paciente e ingrese el código de la caja.', type: 'error' });

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
      selectPatient(selectedPatient.rut, true);
      loadPacientes();

    } catch (error) {
      setVinculoStatus({ loading: false, message: error.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <label htmlFor="buscar-paciente" className="block font-bold">Buscar paciente</label>
        <input id="buscar-paciente" type="search" placeholder="Buscar por RUT o nombre..." disabled={vinculoStatus.loading}
          className="min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); verResultados(); } }}
          value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setMostrarTodos(false); setListaAbierta(true); }} />
        <p className="text-sm text-muted-foreground">Busque en todos los pacientes y seleccione uno en la lista de abajo para asociar su instrumental.</p>
        <button type="button" onClick={verResultados} className="min-h-11 rounded-lg border border-border bg-muted px-4 font-bold">{busqueda ? `Ver resultados (${filteredPatients.length})` : 'Elegir paciente de la lista'}</button>
        {errorPacientes && <p role="alert" className="text-danger">{errorPacientes}</p>}
      </div>

      {/* Vínculo clínico */}
      <div className="space-y-6">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* Columna Izquierda: Formulario Vínculo */}
          <div className="rounded-lg border border-border bg-card p-6 space-y-5">
              <div className="border-b border-border pb-3">
                  <h3 className="font-bold text-foreground text-lg"><i className="fa-solid fa-link text-primary mr-2"></i>Asociación Instrumental - Paciente</h3>
                  <p className="text-sm text-muted-foreground">Busque y seleccione al paciente. Luego escanee la caja utilizada y confirme la asociación.</p>
              </div>

              {vinculoStatus.message && (
                  <div role={vinculoStatus.type === 'success' ? 'status' : 'alert'} className={`p-3 rounded-lg text-sm font-medium text-center ${vinculoStatus.type === 'success' ? 'bg-ok/15 text-ok border border-ok/40' : 'bg-danger/15 text-danger border border-danger/40'}`}>
                      {vinculoStatus.message}
                  </div>
              )}

              <form onSubmit={handleVinculoClinico} className="space-y-4">
                  <div className="p-2.5 border border-border rounded-lg text-sm bg-muted/40">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase block">Paciente seleccionado</span>
                      {selectedPatient ? (
                          <span className="font-bold text-foreground">{selectedPatient.nombre} <span className="text-muted-foreground font-mono font-normal">({selectedPatient.rut})</span></span>
                      ) : (
                          <span className="text-muted-foreground">{cargandoFicha ? 'Cargando ficha…' : 'Busque un paciente o despliegue la lista de abajo.'}</span>
                      )}
                  </div>

                  <div className="flex flex-col gap-1">
                      <label htmlFor="caja-vinculada" className="text-xs font-bold text-muted-foreground uppercase">Código de Caja Utilizada</label>
                      <input
                          id="caja-vinculada"
                          ref={campoCaja}
                          disabled={vinculoStatus.loading || cargandoFicha}
                          type="text"
                          className="p-2.5 border border-border rounded-lg text-sm bg-muted/40 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                          value={cajaCode}
                          onChange={(e) => setCajaCode(e.target.value.toUpperCase())}
                          placeholder="Ej: CAJA-0045"
                      />
                  </div>

                  <button type="submit" disabled={vinculoStatus.loading || cargandoFicha || !selectedPatient || !cajaCode.trim()} className="min-h-12 w-full bg-ok hover:bg-ok/90 disabled:opacity-50 text-primary-foreground font-bold py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
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
                      <p className="text-sm max-w-xs mt-2 mx-auto">{cargandoFicha ? 'Cargando ficha del paciente…' : 'Busque un paciente o selecciónelo en la lista de abajo para ver su ficha.'}</p>
                  </div>
              )}
          </div>
        </div>
          {/* Sección de pacientes: buscador + listado visible con estado de vínculo */}
          <div id="pacientes-registrados" className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                      <h3 className="font-bold text-foreground text-lg"><i className="fa-solid fa-users text-primary mr-2" aria-hidden="true"></i>Pacientes registrados</h3>
                      <p className="text-sm text-muted-foreground">{filteredPatients.length} pacientes{busqueda ? ' encontrados' : ' registrados'}. Al desplegar se muestran hasta 8.</p>
                  </div>
                  <button type="button" aria-expanded={listaAbierta} aria-controls="lista-pacientes" onClick={() => { setListaAbierta(!listaAbierta); setMostrarTodos(false); }} className="min-h-12 rounded-lg border border-border bg-muted px-4 font-bold">{listaAbierta ? 'Ocultar pacientes' : 'Mostrar pacientes'}</button>
              </div>
              {listaAbierta && <div id="lista-pacientes">
              <div className="overflow-x-auto">
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
                      {pacientesVisibles.map(p => (
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
                                  <button type="button" disabled={vinculoStatus.loading || cargandoFicha} onClick={() => selectPatient(p.rut)} aria-label={`Seleccionar a ${p.nombre}`} className="min-h-11 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground px-3 py-2 rounded-lg text-sm font-bold transition-colors">
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
                <p role="status" className="text-sm text-muted-foreground">Mostrando {pacientesVisibles.length} de {filteredPatients.length} pacientes.</p>
                {filteredPatients.length > 8 && <button type="button" onClick={() => setMostrarTodos(!mostrarTodos)} className="min-h-12 rounded-lg border border-border px-4 font-bold hover:bg-muted">{mostrarTodos ? 'Mostrar solo 8 pacientes' : `Ver todos (${filteredPatients.length})`}</button>}
              </div>
              </div>}
          </div>

        </div>
    </div>
  );
}
