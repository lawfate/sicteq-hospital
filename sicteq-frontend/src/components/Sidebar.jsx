import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Sidebar({ onLogout, user }) {
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? "bg-sky-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white";

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between z-10 shadow-lg h-screen">
        <div>
            <div className="p-5 bg-slate-950 flex items-center gap-3 border-b border-slate-800">
                <i className="fa-solid fa-hospital text-sky-400 text-2xl"></i>
                <div>
                    <h1 className="font-bold text-lg leading-tight tracking-wider">SICTEQ</h1>
                    {/* Cambio aplicado aquí abajo */}
                    <span className="text-xs text-slate-400">HFRZ - Gestión</span>
                </div>
            </div>
            
            <nav className="mt-6 px-3 space-y-1">
                <Link to="/" className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${isActive('/')}`}>
                    <i className="fa-solid fa-chart-pie text-lg w-5"></i> Dashboard Central
                </Link>
                <Link to="/solicitudes" className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${isActive('/solicitudes')}`}>
                    <i className="fa-solid fa-clipboard-list text-lg w-5"></i> Solicitudes Pabellón
                </Link>
                <Link to="/ciclo" className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${isActive('/ciclo')}`}>
                    <i className="fa-solid fa-barcode text-lg w-5"></i> Ciclo Trazabilidad
                </Link>
                <Link to="/vinculo" className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${isActive('/vinculo')}`}>
                    <i className="fa-solid fa-link text-lg w-5"></i> Vínculo Clínico
                </Link>
                <Link to="/inventario" className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${isActive('/inventario')}`}>
                    <i className="fa-solid fa-boxes-stacked text-lg w-5"></i> Inventario y Mermas
                </Link>
            </nav>
        </div>
        
        <div className="bg-slate-950 border-t border-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-sm">
                    {user.name.substring(0,2).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-200 truncate">{user.name}</p>
                    <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">{user.role}</p>
                </div>
            </div>
            <button 
                onClick={onLogout}
                className="w-full text-center bg-slate-800 hover:bg-red-900 text-slate-300 hover:text-white text-xs py-1.5 rounded font-bold transition-colors"
            >
                <i className="fa-solid fa-right-from-bracket mr-1"></i> Cerrar Sesión
            </button>
        </div>
    </aside>
  );
}