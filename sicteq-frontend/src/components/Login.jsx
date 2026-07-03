import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

export default function Login({ onLogin }) {
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Llamada real al backend usando la variable de entorno
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al conectar con el servidor');
      }

      // Si es exitoso, pasamos el usuario real (que viene de la BD) a App.jsx
      onLogin({
        id: data.user.id,
        name: data.user.nombre,
        role: data.user.rol
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
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
                {/* Mensaje de Error */}
                {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 text-center font-medium">
                    {error}
                  </div>
                )}

                {/* Input RUT */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">RUT</label>
                    <input 
                        type="text"
                        placeholder="Ej: 11111111-1"
                        className="p-3 border border-slate-300 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        value={rut}
                        onChange={(e) => setRut(e.target.value)}
                        required
                    />
                </div>

                {/* Input Contraseña */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">Contraseña</label>
                    <input 
                        type="password"
                        placeholder="••••••••"
                        className="p-3 border border-slate-300 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                {/* Botón Submit */}
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg hover:shadow-sky-500/20 disabled:opacity-70 flex justify-center items-center gap-2"
                >
                    {isLoading ? (
                      <><i className="fa-solid fa-circle-notch fa-spin"></i> Validando...</>
                    ) : (
                      'Iniciar Sesión'
                    )}
                </button>
            </form>
            <div className="text-center text-xs text-slate-400 pt-2">
                Hospital Dr. Franco Ravera Zunino • Gestión de Proyectos
            </div>
        </div>
    </div>
  );
}