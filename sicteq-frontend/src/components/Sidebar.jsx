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
          'fixed inset-y-0 left-0 z-30 flex w-72 max-w-[90vw] flex-col bg-navigation text-navigation-foreground transition-transform duration-200 lg:static lg:my-4 lg:ml-4 lg:translate-x-0 lg:rounded-[1.75rem] lg:shadow-soft',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-navigation-foreground/15 px-5">
          <div className="leading-tight">
            <p className="text-2xl font-bold tracking-widest">SICTEQ<span className="ml-2 inline-block h-2 w-2 rounded-full bg-navigation-foreground/70" aria-hidden="true" /></p>
            <p className="mt-1 text-[11px] text-navigation-foreground/80">Central de Esterilización · HFRZ</p>
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
                <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-navigation-foreground/75">{seccion.titulo}</p>
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
                          ? 'border-card bg-card font-bold text-primary shadow-card'
                          : 'border-transparent text-navigation-foreground/90 hover:bg-navigation-foreground/10 hover:text-navigation-foreground'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <i className={cn('fa-solid w-5 text-center', item.icono, isActive ? 'text-primary' : 'text-navigation-foreground/85')} aria-hidden="true"></i>
                        {item.nombre}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-navigation-foreground/15 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navigation-foreground/15 text-sm font-bold">
              {user.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="text-xs text-navigation-foreground/80">{user.role === 'Enfermera' ? 'Enfermería' : user.role}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <NavLink to="/clave" onClick={() => setIsOpen(false)} className="text-xs font-bold text-navigation-foreground/90 hover:underline">Cambiar mi clave</NavLink>
            <button type="button" onClick={cambiarTema} className="text-xs font-bold text-navigation-foreground/90 hover:underline">
              {tema === 'claro' ? 'Modo oscuro' : 'Modo claro'}
            </button>
          </div>
          <Button variant="outline" size="sm" className="w-full border-navigation-foreground/25 bg-navigation-foreground/10 text-navigation-foreground hover:bg-navigation-foreground/20" onClick={onLogout}>
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Cerrar sesión
          </Button>
        </div>
      </aside>
    </>
  );
}
