import React from 'react';
import { useLocation } from 'react-router-dom';

export default function Header({ onMenuClick }) {
  const location = useLocation();
  
  const titles = {
    '/': 'Dashboard Central',
    '/solicitudes': 'Solicitudes desde Pabellón',
    '/ciclo': 'Ciclo de Trazabilidad Activo',
    '/vinculo': 'Vínculo Clínico de Pacientes',
    '/inventario': 'Inventario y Mermas'
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
            {/* Botón Hamburguesa - Solo visible en móviles */}
            <button 
                onClick={onMenuClick}
                className="md:hidden w-10 h-10 flex items-center justify-center text-slate-500 hover:text-sky-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
                <i className="fa-solid fa-bars text-lg"></i>
            </button>

            {/* Título de Ubicación */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-500 hidden sm:inline">Ubicación:</span>
                <span className="text-xs sm:text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-full truncate max-w-[150px] sm:max-w-none">
                    {titles[location.pathname] || 'SICTEQ'}
                </span>
            </div>
        </div>
        
        {/* Etiqueta del Hospital */}
        <div className="hidden sm:block text-xs text-slate-400 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
            Hospital Dr. Franco Ravera Zunino • Red Asistencial
        </div>
    </header>
  );
}