import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

// Importante: Recibimos el 'user' como prop (la enfermera conectada)
export default function Solicitudes({ user }) {
  const [areas, setAreas] = useState([]);
  const [formData, setFormData] = useState({
    cirugia: 'Programada',
    area_id: '',
    instrumental: 'Set Estándar de Cesárea',
    obs: ''
  });
  const [status, setStatus] = useState({ loading: false, message: '', type: '' });

  // 1. Cargar las 22 áreas desde el backend al iniciar la vista
  useEffect(() => {
    fetch(`${API_URL}/api/solicitudes/areas`)
      .then(res => res.json())
      .then(data => {
        setAreas(data);
        if (data.length > 0) {
          // Seleccionamos el primer pabellón por defecto
          setFormData(prev => ({ ...prev, area_id: data[0].id })); 
        }
      })
      .catch(err => console.error("Error al cargar áreas:", err));
  }, []);

  // 2. Enviar la solicitud a la base de datos
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, message: '', type: '' });

    try {
      const response = await fetch(`${API_URL}/api/solicitudes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: user.id, // <-- Aquí amarramos la petición a la enfermera
          area_id: formData.area_id,
          tipo_cirugia: formData.cirugia,
          instrumental: formData.instrumental,
          observaciones: formData.obs
        })
      });

      if (!response.ok) throw new Error('Error al enviar la solicitud');

      setStatus({ loading: false, message: '¡Requerimiento enviado con éxito a la Central!', type: 'success' });
      setFormData({ ...formData, obs: '' }); // Limpiamos solo las observaciones tras el éxito

      // Ocultar el mensaje de éxito después de 3 segundos
      setTimeout(() => setStatus({ loading: false, message: '', type: '' }), 3000);

    } catch (error) {
      setStatus({ loading: false, message: error.message, type: 'error' });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-900">Nueva Solicitud de Instrumental Quirúrgico</h2>
        <p className="text-xs text-slate-500">Módulo exclusivo para solicitudes asistenciales. Usuario actual: <span className="font-bold text-sky-600">{user?.name}</span></p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        {/* Alertas de Éxito o Error */}
        {status.message && (
          <div className={`p-3 rounded-lg text-sm font-medium text-center ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {status.message}
          </div>
        )}

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
                value={formData.area_id}
                onChange={(e) => setFormData({...formData, area_id: e.target.value})}
                className="p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-sky-500 outline-none"
            >
              {/* Iteramos sobre las 22 áreas traídas de la BD */}
              {areas.map(area => (
                <option key={area.id} value={area.id}>{area.nombre}</option>
              ))}
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
                className="p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 h-24 focus:ring-2 focus:ring-sky-500 outline-none resize-none" 
                placeholder="Ej: Adicionar pinzas de disección largas..."
            ></textarea>
        </div>

        <button 
          type="submit" 
          disabled={status.loading}
          className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-bold py-2.5 rounded-lg text-sm transition-colors shadow-md flex justify-center items-center gap-2"
        >
            {status.loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Procesando...</> : 'Enviar Requerimiento en Línea'}
        </button>
      </form>
    </div>
  );
}