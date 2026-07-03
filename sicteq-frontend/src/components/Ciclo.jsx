import React, { useState } from 'react';
import Modal from './Modal';

export default function Ciclo() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeBox, setActiveBox] = useState(null);
  const [logs, setLogs] = useState([]);
  const [targetStage, setTargetStage] = useState(1);
  const [rollbackReason, setRollbackReason] = useState("");

  const steps = [
    { id: 1, name: "Recepción", icon: "fa-check" },
    { id: 2, name: "Lavado", icon: "fa-soap" },
    { id: 3, name: "Preparación", icon: "fa-wrench" },
    { id: 4, name: "Autoclave", icon: "fa-circle-radiation" },
    { id: 5, name: "Entrega", icon: "fa-truck-ramp-box" }
  ];

  // Definimos la URL base usando la variable de entorno de Vite o el fallback local
  const API_URL = import.meta.env.VITE_API_URL;

  const handleSearch = async () => {
    try {
      const id = searchText.replace('#FOL-', '');
      const response = await fetch(`${API_URL}/api/trazabilidad/buscar/${id}`);
      
      // 1. Si el backend responde con error (404, 500, etc), extraemos el mensaje real
      if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `Error del servidor: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 2. Validamos que el backend realmente envió un historial y no un array vacío
      if (!data || data.length === 0) {
          throw new Error("El folio no tiene un historial válido asociado (array vacío).");
      }
      
      const ultimoRegistro = data[0]; 
      
      // 3. Validamos que el registro tenga la estructura esperada
      if (!ultimoRegistro || !ultimoRegistro.area_destino_id) {
          console.warn("Registro devuelto por la BD está incompleto:", ultimoRegistro);
      }
      
      setActiveBox({ 
          folio: searchText, 
          stage: parseInt(ultimoRegistro?.area_destino_id) || 1 
      }); 
      setTargetStage(parseInt(ultimoRegistro?.area_destino_id) || 1);
      
      setLogs(data); 
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
      const id = searchText.replace('#FOL-', '');
      const response = await fetch(`${API_URL}/api/trazabilidad/actualizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            id: id, 
            stage: targetStage,
            reason: rollbackReason
        })
      });

      if (!response.ok) throw new Error("Error al actualizar estado");

      setRollbackReason("");
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
        <p className="text-slate-500 text-sm">Escanee el folio para auditar o avanzar la línea de tiempo.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 h-fit">
            <h3 className="font-bold text-slate-800 text-sm">Entrada de Acción</h3>
            <div className="space-y-3">
                <input 
                  type="text" 
                  value={searchText} 
                  onChange={(e) => setSearchText(e.target.value)} 
                  placeholder="#FOL-..." 
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono bg-slate-50" 
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
                <h3 className="font-bold text-slate-800">Línea de Tiempo: {activeBox.folio}</h3>
                <div className="flex justify-between relative px-2 mb-4">
                    <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 -z-0"></div>
                    {steps.map((step) => (
                        <div key={step.id} className="flex flex-col items-center relative z-10">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${activeBox.stage >= step.id ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                <i className={`fa-solid ${step.icon}`}></i>
                            </div>
                            <span className="text-[10px] font-bold mt-2 text-slate-500 uppercase">{step.name}</span>
                        </div>
                    ))}
                </div>
                
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase">Bitácora</h4>
                    {logs.map((log, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                            <p className="font-bold text-slate-800">{log.estado_nuevo || log.event || "Actualización de estado"}</p>
                            {log.justificacion && log.justificacion !== `Avance a Etapa ${log.area_destino_id}` && (
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