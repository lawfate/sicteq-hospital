import { useEffect } from 'react';
import { nombreEstado } from '@/etapas';

export default function Modal({ isOpen, onClose, content, children }) {
  // Escape cierra el diálogo, como en cualquier ventana del sistema.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="modal-titulo" className="relative w-full max-w-lg rounded-lg border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Cerrar" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-md text-xl text-muted-foreground hover:bg-muted hover:text-foreground">
          &times;
        </button>

        <h3 id="modal-titulo" className="mb-4 pr-8 text-lg font-bold">{content.title}</h3>

        {content.items && content.items.length > 0 && (
          <div className="mb-6 max-h-96 space-y-2 overflow-y-auto">
            {content.items.map((item, idx) => (
              <div key={idx} className="rounded-md border border-border bg-background p-3 text-sm">
                <p className="font-bold">{item.estado_nuevo ? nombreEstado(item.estado_nuevo) : item.event}</p>
                <p className="text-xs text-muted-foreground">Destino: {item.destino_nombre || '—'}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {item.fecha_cambio ? new Date(item.fecha_cambio).toLocaleString('es-CL') : item.time}
                </p>
              </div>
            ))}
          </div>
        )}
        {content.items && content.items.length === 0 && content.emptyMessage && (
          <p className="mb-6 text-sm italic text-muted-foreground">{content.emptyMessage}</p>
        )}

        {children && <div className="mt-4 border-t border-border pt-4">{children}</div>}
      </div>
    </div>
  );
}
