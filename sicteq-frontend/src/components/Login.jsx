import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [selectedRole, setSelectedRole] = useState('Enfermera');

  const handleLogin = (e) => {
    e.preventDefault();
    // Enviamos el rol seleccionado hacia el componente App
    onLogin(selectedRole); 
  };

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md space-y-6 border border-slate-200">
            <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mx-auto text-3xl shadow-sm">
                    <i className="fa-solid fa-hospital-user"></i>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">SICTEQ</h1>
                <p className="text-sm text-slate-500">Ingreso al Sistema de Esterilización - HFRZ</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">Seleccionar Perfil / Rol</label>
                    <select 
                        className="p-3 border border-slate-300 rounded-xl text-sm bg-slate-50 font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                    >
                        <option value="Enfermera">Enfermera Quirúrgica / Pabellón</option>
                        <option value="TENS">TENS - Central de Esterilización</option>
                        <option value="IT">Encargado de Informática (IT)</option>
                    </select>
                </div>
                {/* ... resto del formulario ... */}
                <button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg hover:shadow-sky-500/20">
                    Iniciar Sesión
                </button>
            </form>
            <div className="text-center text-xs text-slate-400 pt-2">
                Hospital Dr. Franco Ravera Zunino • Gestión de Proyectos
            </div>
        </div>
    </div>
  );
}