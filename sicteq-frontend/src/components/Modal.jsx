import React from 'react';

export default function Modal({ isOpen, onClose, content, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      {/* Contenedor blanco */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative">
        {/* Botón X para cerrar */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl"
        >
          &times;
        </button>

        {/* Título */}
        <h3 className="text-lg font-bold text-slate-800 mb-4">{content.title}</h3>

        {/* Lista de movimientos - Renderizado condicional seguro */}
        {content.items && content.items.length > 0 && (
          <div className="space-y-3 max-h-96 overflow-y-auto mb-6">
            {content.items.map((item, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                <p className="font-semibold text-slate-700">{item.estado_nuevo || item.event}</p>
                <p className="text-slate-500 text-xs">Destino: {item.destino_nombre || 'N/A'}</p>
                <p className="text-slate-400 text-[10px] mt-1">
                  {item.fecha_cambio ? new Date(item.fecha_cambio).toLocaleString() : item.time}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Renderizado de children (botón confirmar, textarea, etc.) */}
        {children && (
            <div className="mt-4 border-t pt-4">
                {children}
            </div>
        )}
      </div>
    </div>
  );
}