import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { aplicarTema, temaActual } from '@/tema';
import { SECCIONES, puedeVer } from '@/navegacion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function Sidebar({ onLogout, user, isOpen, setIsOpen }) {
  const [tema, setTema] = useState(temaActual);
  const [escritorio, setEscritorio] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const actualizar = () => setEscritorio(media.matches);
    media.addEventListener('change', actualizar);
    return () => media.removeEventListener('change', actualizar);
  }, []);
  const panel = useRef(null);
  useEffect(() => {
    if (!isOpen || window.innerWidth >= 1024) return;
    const anterior = document.activeElement;
    panel.current.querySelector('button')?.focus();
    const tecla = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
      if (e.key === 'Tab') {
        const elementos = [...panel.current.querySelectorAll('button, a[href]')];
        const primero = elementos[0];
        const ultimo = elementos.at(-1);
        if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
      }
    };
    window.addEventListener('keydown', tecla);
    return () => { window.removeEventListener('keydown', tecla); if (anterior?.isConnected) anterior.focus(); };
  }, [isOpen, setIsOpen]);
  const cambiarTema = () => { const t = tema === 'claro' ? 'oscuro' : 'claro'; aplicarTema(t); setTema(t); };
  const cerrarEnMovil = () => { if (window.innerWidth < 1024) setIsOpen?.(false); };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setIsOpen(false)} />
      )}

      <aside
        ref={panel}
        inert={!isOpen && !escritorio ? true : undefined}
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-72 max-w-[90vw] flex-col border-r border-border bg-card transition-transform duration-200 lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
          <div className="leading-tight">
            <p className="font-mono text-lg font-bold tracking-[0.2em] text-primary">SICTEQ</p>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Central de Esterilización · HFRZ</p>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsOpen(false)} aria-label="Cerrar menú">
            <i className="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
          </Button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Menú principal">
          {SECCIONES.map((seccion) => {
            const items = seccion.items.filter((i) => puedeVer(i, user.role));
            if (!items.length) return null;
            return (
              <div key={seccion.titulo} className="space-y-1">
                <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">{seccion.titulo}</p>
                {items.map((item) => (
                  <NavLink
                    key={item.ruta}
                    to={item.ruta}
                    end
                    onClick={cerrarEnMovil}
                    className={({ isActive }) =>
                      cn(
                        'group flex min-h-11 items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-[15px] transition-colors',
                        isActive
                          ? 'border-primary bg-primary/10 font-bold text-foreground'
                          : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <i className={cn('fa-solid w-5 text-center', item.icono, isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} aria-hidden="true"></i>
                        {item.nombre}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted font-mono text-sm font-bold text-primary">
              {user.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{user.role}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <NavLink to="/clave" onClick={() => setIsOpen(false)} className="text-xs font-bold text-muted-foreground hover:text-foreground">Cambiar mi clave</NavLink>
            <button type="button" onClick={cambiarTema} className="text-xs font-bold text-muted-foreground hover:text-foreground">
              {tema === 'claro' ? 'Modo oscuro' : 'Modo claro'}
            </button>
          </div>
          <Button variant="secondary" size="sm" className="w-full" onClick={onLogout}>
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Cerrar sesión
          </Button>
        </div>
      </aside>
    </>
  );
}
