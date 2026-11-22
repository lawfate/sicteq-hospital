import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pantallaDe } from '@/navegacion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const reloj = () => new Date().toLocaleString('es-CL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function Header({ onMenuClick, onAyuda }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const pantalla = pantallaDe(pathname);
  // La Central trabaja por turnos: la hora siempre visible ayuda a registrar a tiempo.
  const [ahora, setAhora] = useState(reloj);
  const [codigoCaja, setCodigoCaja] = useState("");
  useEffect(() => {
    const t = setInterval(() => setAhora(reloj()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  // Versión nueva desplegada: al cambiar de pantalla se compara el script del
  // index.html publicado con el cargado; si cambió, se recarga (nadie queda con
  // una versión vieja abierta todo el turno). En desarrollo no hay /assets/index-*.
  useEffect(() => {
    const actual = document.querySelector('script[src*="/assets/index-"]')?.getAttribute('src');
    if (!actual) return;
    fetch('/', { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : ''))
      .then((html) => { if (html.includes('/assets/index-') && !html.includes(actual)) window.location.reload(); })
      .catch(() => {});
  }, [pathname]);

  const buscarCaja = (event) => {
    event.preventDefault();
    const codigo = codigoCaja.trim().toUpperCase();
    if (!codigo) return;
    navigate(`/ciclo?codigo=${encodeURIComponent(codigo)}`);
    setCodigoCaja("");
  };

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Abrir menú">
          <i className="fa-solid fa-bars text-lg" aria-hidden="true"></i>
        </Button>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-lg font-bold">{pantalla?.nombre || 'SICTEQ'}</p>
          {pantalla?.ayuda && <p className="hidden truncate text-xs text-muted-foreground sm:block">{pantalla.ayuda}</p>}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 max-sm:basis-full">
      <form onSubmit={buscarCaja} className="flex min-w-0 flex-1 gap-2 sm:max-w-sm">
        <Input
          value={codigoCaja}
          onChange={(event) => setCodigoCaja(event.target.value.toUpperCase())}
          placeholder="Código de caja…"
          aria-label="Buscar caja por código"
          className="min-w-0 font-mono uppercase"
        />
        <Button type="submit" variant="secondary" className="px-3" aria-label="Buscar caja"><i className="fa-solid fa-barcode" aria-hidden="true" /><span className="hidden md:inline">Buscar</span></Button>
      </form>
      <Button variant="ghost" onClick={onAyuda} aria-label="Repetir recorrido de bienvenida" className="px-3"><i className="fa-solid fa-circle-question text-primary" aria-hidden="true" /><span className="hidden xl:inline">Repetir recorrido</span><span className="xl:hidden">Guía</span></Button>
      <p className="hidden shrink-0 font-mono text-sm text-muted-foreground xl:block">{ahora}</p>
      </div>
    </header>
  );
}
