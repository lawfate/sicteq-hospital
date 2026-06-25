import React from 'react';
import { useLocation } from 'react-router-dom';

export default function Header() {
  const location = useLocation();
  
  const titles = {
    '/': 'Dashboard Central',
    '/solicitudes': 'Solicitudes desde Pabellón',
    '/ciclo': 'Ciclo de Trazabilidad Activo',
    '/vinculo': 'Vínculo Clínico de Pacientes',
    '/inventario': 'Inventario y Mermas'
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm">
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500">Ubicación:</span>
            <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-full">
                {titles[location.pathname] || 'SICTEQ'}
            </span>
        </div>
        <div className="text-xs text-slate-400 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
            Hospital Dr. Franco Ravera Zunino • Red Asistencial
        </div>
    </header>
  );
}