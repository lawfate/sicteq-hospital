import React, { useState } from 'react';
import Modal from './Modal';

export default function Ciclo() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeBox, setActiveBox] = useState(null);
  const [logs, setLogs] = useState([]);
  
  const [targetStage, setTargetStage] = useState(1);
  const [rollbackReason, setRollbackReason] = useState("");

  const [cajasDB] = useState([
    { folio: "#FOL-1042", stage: 1 }, 
    { folio: "#FOL-1043", stage: 3 },
  ]);

  const steps = [
    { id: 1, name: "Recepción", icon: "fa-check" },
    { id: 2, name: "Lavado", icon: "fa-soap" },
    { id: 3, name: "Preparación", icon: "fa-wrench" },
    { id: 4, name: "Autoclave", icon: "fa-circle-radiation" },
    { id: 5, name: "Entrega", icon: "fa-truck-ramp-box" }
  ];

  const handleSearch = () => {
    const found = cajasDB.find(c => c.folio === searchText);
    if (found) {
        setActiveBox(found);
        setTargetStage(found.stage);
        setLogs([{ id: 1, event: "Inicio de Seguimiento", operator: "TENS Juan Carlos", time: new Date().toLocaleTimeString() }]);
    } else {
        alert("Folio no encontrado.");
    }
  };

  const executeAction = () => {
    if (targetStage < activeBox.stage && !rollbackReason.trim()) {
        alert("ERROR: Debe ingresar el motivo técnico del retroceso.");
        return;
    }

    const newLog = {
        id: Date.now(),
        event: `${targetStage}. ${steps[targetStage-1].name} ${targetStage < activeBox.stage ? '(RETROCESO)' : ''}`,
        operator: "Enf. Ana María",
        time: new Date().toLocaleTimeString(),
        reason: rollbackReason
    };
    
    setLogs([newLog, ...logs]);
    setActiveBox({ ...activeBox, stage: targetStage });
    setRollbackReason("");
    setIsModalOpen(false);
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
                <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="#FOL-..." className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono bg-slate-50" />
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
                    {logs.map(log => (
                        <div key={log.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                            <p className="font-bold text-slate-800">{log.event}</p>
                            {log.reason && (
                                <p className="text-red-700 font-semibold mt-1 bg-white p-2 rounded border border-red-200">
                                    <span className="font-bold text-[10px] uppercase block text-red-400">Motivo de Desviación:</span> 
                                    {log.reason}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Confirmar Acción">
        <div className="space-y-4">
            <p className="text-sm text-slate-600">¿Confirmas ejecutar: <strong>{steps[targetStage-1].name}</strong>?</p>
            {targetStage < activeBox?.stage && (
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                    <label className="text-xs font-bold text-red-800 block mb-2">Motivo de Retroceso (Obligatorio)</label>
                    <textarea className="w-full p-2 rounded text-sm" value={rollbackReason} onChange={(e) => setRollbackReason(e.target.value)}></textarea>
                </div>
            )}
            <div className="flex gap-3">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-2 bg-slate-100 rounded-lg text-sm font-bold">Cancelar</button>
                <button onClick={executeAction} className="flex-1 py-2 bg-sky-600 text-white rounded-lg text-sm font-bold">Confirmar</button>
            </div>
        </div>
      </Modal>
    </section>
  );
}