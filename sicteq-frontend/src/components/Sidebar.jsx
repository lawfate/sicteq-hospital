import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Sidebar({ onLogout, user, isOpen, setIsOpen }) {
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? "bg-sky-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white";

  // Función para cerrar el menú en móviles al hacer clic en un enlace
  const handleLinkClick = () => {
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Overlay oscuro para móvil cuando el menú está abierto */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/80 z-20 md:hidden backdrop-blur-sm transition-opacity" 
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* Menú Lateral (Sidebar) */}
      <aside className={`fixed md:static inset-y-0 left-0 w-64 bg-slate-900 text-white flex flex-col justify-between z-30 shadow-2xl h-screen transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out border-r border-slate-800`}>
        <div>
            <div className="p-5 bg-slate-950 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <i className="fa-solid fa-hospital text-sky-400 text-2xl"></i>
                    <div>
                        <h1 className="font-bold text-lg leading-tight tracking-wider">SICTEQ</h1>
                        <span className="text-xs text-slate-400">HFRZ - Gestión</span>
                    </div>
                </div>
                {/* Botón X para cerrar en móvil */}
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="md:hidden w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
            </div>
            
            <nav className="mt-6 px-3 space-y-1">
                <Link to="/" onClick={handleLinkClick} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${isActive('/')}`}>
                    <i className="fa-solid fa-chart-pie text-lg w-5"></i> Dashboard Central
                </Link>
                <Link to="/solicitudes" onClick={handleLinkClick} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${isActive('/solicitudes')}`}>
                    <i className="fa-solid fa-clipboard-list text-lg w-5"></i> Solicitudes Pabellón
                </Link>
                <Link to="/ciclo" onClick={handleLinkClick} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${isActive('/ciclo')}`}>
                    <i className="fa-solid fa-barcode text-lg w-5"></i> Ciclo Trazabilidad
                </Link>
                <Link to="/vinculo" onClick={handleLinkClick} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${isActive('/vinculo')}`}>
                    <i className="fa-solid fa-link text-lg w-5"></i> Vínculo Clínico
                </Link>
                <Link to="/inventario" onClick={handleLinkClick} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${isActive('/inventario')}`}>
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
    </>
  );
}