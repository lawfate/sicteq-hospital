import { NavLink } from 'react-router-dom';
import { SECCIONES, puedeVer } from '@/navegacion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function Sidebar({ onLogout, user, isOpen, setIsOpen }) {
  const cerrarEnMovil = () => { if (window.innerWidth < 768) setIsOpen?.(false); };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setIsOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200 md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
          <div className="leading-tight">
            <p className="font-mono text-lg font-bold tracking-[0.2em] text-primary">SICTEQ</p>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Central de Esterilización · HFRZ</p>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsOpen(false)} aria-label="Cerrar menú">
            <i className="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
          </Button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Menú principal">
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
                        'group flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-[15px] transition-colors',
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
          <NavLink to="/clave" onClick={() => setIsOpen(false)} className="block text-xs font-bold text-muted-foreground hover:text-foreground">Cambiar mi clave</NavLink>
          <Button variant="secondary" size="sm" className="w-full" onClick={onLogout}>
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Cerrar sesión
          </Button>
        </div>
      </aside>
    </>
  );
}
