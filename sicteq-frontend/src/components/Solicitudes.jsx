import React, { useState } from 'react';

export default function Solicitudes() {
  const [formData, setFormData] = useState({
    cirugia: 'Programada',
    pabellón: 'Pabellón 1',
    instrumental: 'Set Estándar de Cesárea',
    obs: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`Solicitud enviada:\n\nCirugía: ${formData.cirugia}\nDestino: ${formData.pabellón}\nInstrumental: ${formData.instrumental}`);
    setFormData({ ...formData, obs: '' });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-900">Nueva Solicitud de Instrumental Quirúrgico</h2>
        <p className="text-xs text-slate-500">Módulo exclusivo para solicitudes asistenciales.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Cirugía</label>
            <select 
                value={formData.cirugia}
                onChange={(e) => setFormData({...formData, cirugia: e.target.value})}
                className="p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-sky-500 outline-none"
            >
              <option>Programada</option>
              <option>Urgencia Médica</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Pabellón Destino</label>
            <select 
                value={formData.pabellón}
                onChange={(e) => setFormData({...formData, pabellón: e.target.value})}
                className="p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-sky-500 outline-none"
            >
              <option>Pabellón 1</option>
              <option>Pabellón 2</option>
              <option>Pabellón 3</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Instrumental Requerido</label>
            <select 
                value={formData.instrumental}
                onChange={(e) => setFormData({...formData, instrumental: e.target.value})}
                className="p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-sky-500 outline-none"
            >
                <option>Set Estándar de Cesárea</option>
                <option>Set Colecistectomía Laparoscópica</option>
                <option>Caja de Instrumental Mayor Cirugía General</option>
            </select>
        </div>

        <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Observaciones Especiales</label>
            <textarea 
                value={formData.obs}
                onChange={(e) => setFormData({...formData, obs: e.target.value})}
                className="p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 h-24 focus:ring-2 focus:ring-sky-500 outline-none" 
                placeholder="Ej: Adicionar pinzas de disección largas..."
            ></textarea>
        </div>

        <button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 rounded-lg text-sm transition-colors shadow-md">
            Enviar Requerimiento en Línea
        </button>
      </form>
    </div>
  );
}