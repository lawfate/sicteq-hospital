import { useState } from 'react';
import Modal from './Modal';

// Deriva el número de etapa desde el texto de estado_nuevo, ej. "Etapa 3".
// area_destino_id NO sirve para esto: esa columna referencia el pabellón/área
// física de destino (tabla AREA), un concepto distinto de la etapa del ciclo.
const parseStage = (estadoNuevo) => {
  const match = String(estadoNuevo || '').match(/Etapa\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : 1;
};

// Orden según el requerimiento formal: recepción, lavado, preparación,
// esterilización, almacenamiento, entrega. Antes solo había 5 etapas y faltaba
// "Almacenamiento" como paso propio entre esterilizar y entregar.
const ESTERILIZACION_STAGE_ID = 4;

const METODOS_ESTERILIZACION = ["Autoclave", "Óxido de Etileno", "Plasma de Peróxido de Hidrógeno"];

export default function Ciclo() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeBox, setActiveBox] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pacientesVinculados, setPacientesVinculados] = useState([]);
  const [targetStage, setTargetStage] = useState(1);
  const [rollbackReason, setRollbackReason] = useState("");
  const [metodo, setMetodo] = useState(METODOS_ESTERILIZACION[0]);
  const [temperatura, setTemperatura] = useState("");
  const [presion, setPresion] = useState("");
  const [tiempoMinutos, setTiempoMinutos] = useState("");

  const steps = [
    { id: 1, name: "Recepción", icon: "fa-check" },
    { id: 2, name: "Lavado", icon: "fa-soap" },
    { id: 3, name: "Preparación", icon: "fa-wrench" },
    { id: 4, name: "Esterilización", icon: "fa-circle-radiation" },
    { id: 5, name: "Almacenamiento", icon: "fa-warehouse" },
    { id: 6, name: "Entrega", icon: "fa-truck-ramp-box" }
  ];

  // Definimos la URL base usando la variable de entorno de Vite o el fallback local
  const API_URL = import.meta.env.VITE_API_URL;

  const handleSearch = async () => {
    try {
      const codigo = searchText.trim().toUpperCase();
      if (!codigo) return;

      const response = await fetch(`${API_URL}/api/trazabilidad/buscar/${encodeURIComponent(codigo)}`);

      // 1. Si el backend responde con error (404, 500, etc), extraemos el mensaje real
      if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `Error del servidor: ${response.status}`);
      }

      const data = await response.json();

      // 2. Validamos que el backend realmente envió un historial y no un array vacío
      if (!data || data.length === 0) {
          throw new Error("Esta caja todavía no tiene ningún movimiento registrado.");
      }

      const ultimoRegistro = data[0];

      // 3. Validamos que el registro tenga la estructura esperada
      if (!ultimoRegistro || !ultimoRegistro.estado_nuevo) {
          console.warn("Registro devuelto por la BD está incompleto:", ultimoRegistro);
      }

      const stageActual = parseStage(ultimoRegistro?.estado_nuevo);

      setActiveBox({
          codigo,
          stage: stageActual
      });
      setTargetStage(stageActual);

      setLogs(data);

      // Dirección caja -> paciente de la trazabilidad bidireccional: qué
      // paciente(s) se le vincularon a esta caja física, si los hay.
      fetch(`${API_URL}/api/cajas/${encodeURIComponent(codigo)}/pacientes`)
        .then(r => r.ok ? r.json() : [])
        .then(p => setPacientesVinculados(Array.isArray(p) ? p : []))
        .catch(() => setPacientesVinculados([]));
    } catch (err) {
      console.error(">>> ERROR DETALLADO:", err);
      alert("Problema al buscar: " + err.message);
    }
  };

  const executeAction = async () => {
    if (targetStage < activeBox.stage && !rollbackReason.trim()) {
      alert("ERROR: Debe ingresar el motivo técnico del retroceso.");
      return;
    }

    try {
      // Usamos la caja ya cargada (activeBox), no el input de busqueda en vivo:
      // si el usuario edita o borra el campo despues de buscar pero antes de
      // confirmar, searchText ya no coincide con la caja que esta en pantalla.
      const body = {
        codigo: activeBox.codigo,
        stage: targetStage,
        reason: rollbackReason
      };

      // Los parámetros del ciclo solo se registran cuando la etapa es Esterilización.
      if (targetStage === ESTERILIZACION_STAGE_ID) {
        body.metodo = metodo;
        body.temperatura = temperatura;
        body.presion = presion;
        body.tiempoMinutos = tiempoMinutos;
      }

      const response = await fetch(`${API_URL}/api/trazabilidad/actualizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error("Error al actualizar estado");

      setRollbackReason("");
      setTemperatura("");
      setPresion("");
      setTiempoMinutos("");
      setIsModalOpen(false);
      alert("Etapa actualizada con éxito");

      handleSearch();

    } catch (err) {
      alert("No se pudo procesar la acción: " + err.message);
    }
  };

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Ciclo de Trazabilidad</h2>
        <p className="text-slate-500 text-sm">Escanee el código de la caja para auditar o avanzar la línea de tiempo.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 h-fit">
            <h3 className="font-bold text-slate-800 text-sm">Entrada de Acción</h3>
            <div className="space-y-3">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Ej: CAJA-0045"
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono bg-slate-50 uppercase tracking-wider"
                />
                <button onClick={handleSearch} className="w-full bg-slate-900 text-white py-2 rounded-lg font-bold text-sm hover:bg-slate-800">Buscar</button>

                {activeBox && (
                    <select value={targetStage} onChange={(e) => setTargetStage(parseInt(e.target.value))} className="w-full p-2 border border-sky-300 rounded-lg text-sm bg-sky-50 font-bold text-sky-700">
                        {steps.map(s => <option key={s.id} value={s.id}>{s.id}. {s.name}</option>)}
                    </select>
                )}
            </div>
            {activeBox && (
                <button onClick={() => setIsModalOpen(true)} className="w-full bg-sky-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-sky-700">
                    Procesar Acción
                </button>
            )}
        </div>

        {activeBox && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-2 space-y-6">
                <h3 className="font-bold text-slate-800">Línea de Tiempo: <span className="font-mono text-sky-700">{activeBox.codigo}</span></h3>
                <div className="flex justify-between relative px-2 mb-4">
                    <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 -z-0"></div>
                    {steps.map((step) => (
                        <div key={step.id} className="flex flex-col items-center relative z-10">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${activeBox.stage >= step.id ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                <i className={`fa-solid ${step.icon}`}></i>
                            </div>
                            <span className="text-[9px] font-bold mt-2 text-slate-500 uppercase text-center">{step.name}</span>
                        </div>
                    ))}
                </div>

                {pacientesVinculados.length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                        <h4 className="text-xs font-bold text-emerald-700 uppercase flex items-center gap-2"><i className="fa-solid fa-user-injured"></i>Paciente(s) vinculado(s) a esta caja</h4>
                        {pacientesVinculados.map(p => (
                            <div key={p.id} className="flex justify-between items-center bg-white p-2 rounded border border-emerald-100 text-xs">
                                <span className="font-bold text-slate-800">{p.nombre} <span className="text-slate-400 font-mono font-normal">({p.rut})</span></span>
                                <span className="text-slate-500">{new Date(p.fecha_vinculo).toLocaleDateString()}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase">Bitácora</h4>
                    {logs.map((log, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                            <p className="font-bold text-slate-800">{log.estado_nuevo || log.event || "Actualización de estado"}</p>
                            {log.metodo_esterilizacion && (
                                <p className="text-sky-700 font-mono text-[11px] mt-1">
                                    {log.metodo_esterilizacion}
                                    {log.temperatura ? ` · ${log.temperatura}°C` : ''}
                                    {log.presion ? ` · ${log.presion}` : ''}
                                    {log.tiempo_minutos ? ` · ${log.tiempo_minutos} min` : ''}
                                </p>
                            )}
                            {log.justificacion && log.justificacion !== `Avance a ${log.estado_nuevo}` && (
                                <p className="text-red-600 italic">Motivo/Comentario: {log.justificacion}</p>
                            )}
                            <p className="text-slate-500">{log.fecha_cambio ? new Date(log.fecha_cambio).toLocaleString() : log.time}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        content={{ title: "Confirmar Acción", items: logs }}
      >
          <div className="space-y-4">
              {targetStage === ESTERILIZACION_STAGE_ID && (
                  <div className="bg-sky-50 p-3 rounded-lg border border-sky-200 space-y-3">
                      <p className="text-xs font-bold text-sky-800 uppercase">Parámetros del ciclo de esterilización</p>
                      <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-500 uppercase">Método</label>
                          <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className="w-full p-2 rounded text-sm border border-slate-300 bg-white">
                              {METODOS_ESTERILIZACION.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-bold text-slate-500 uppercase">Temp. (°C)</label>
                              <input type="number" step="0.1" className="w-full p-2 rounded text-sm border border-slate-300" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} placeholder="134" />
                          </div>
                          <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-bold text-slate-500 uppercase">Presión</label>
                              <input type="text" className="w-full p-2 rounded text-sm border border-slate-300" value={presion} onChange={(e) => setPresion(e.target.value)} placeholder="2.1 bar" />
                          </div>
                          <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-bold text-slate-500 uppercase">Tiempo (min)</label>
                              <input type="number" className="w-full p-2 rounded text-sm border border-slate-300" value={tiempoMinutos} onChange={(e) => setTiempoMinutos(e.target.value)} placeholder="20" />
                          </div>
                      </div>
                  </div>
              )}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <label className="text-xs font-bold text-slate-700 block mb-2">
                      {targetStage < activeBox?.stage ? "Motivo de Retroceso (Obligatorio)" : "Comentario Adicional (Opcional)"}
                  </label>
                  <textarea
                      className="w-full p-2 rounded text-sm border border-slate-300"
                      value={rollbackReason}
                      onChange={(e) => setRollbackReason(e.target.value)}
                      placeholder="Escriba aquí..."
                  ></textarea>
              </div>
            <button onClick={executeAction} className="w-full bg-sky-600 text-white py-2 rounded-lg font-bold text-sm">
                Confirmar
            </button>
          </div>
      </Modal>
    </section>
  );
}
