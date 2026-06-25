import React from 'react';

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 transform transition-all p-6 space-y-4">
        {/* Encabezado del modal */}
        <div className="text-center space-y-2">
            <h3 className="font-bold text-lg text-slate-900">{title}</h3>
        </div>
        
        {/* Contenido dinámico */}
        {children}
      </div>
    </div>
  );
}