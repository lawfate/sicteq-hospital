import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pantallaDe } from '@/navegacion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const reloj = () => new Date().toLocaleString('es-CL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function Header({ onMenuClick }) {
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

  const buscarCaja = (event) => {
    event.preventDefault();
    const codigo = codigoCaja.trim().toUpperCase();
    if (!codigo) return;
    navigate(`/ciclo?codigo=${encodeURIComponent(codigo)}`);
    setCodigoCaja("");
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card/60 px-4 md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick} aria-label="Abrir menú">
          <i className="fa-solid fa-bars text-lg" aria-hidden="true"></i>
        </Button>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-lg font-bold">{pantalla?.nombre || 'SICTEQ'}</p>
          {pantalla?.ayuda && <p className="hidden truncate text-xs text-muted-foreground sm:block">{pantalla.ayuda}</p>}
        </div>
      </div>
      <form onSubmit={buscarCaja} className="shrink-0">
        <Input
          value={codigoCaja}
          onChange={(event) => setCodigoCaja(event.target.value.toUpperCase())}
          placeholder="Escanear caja"
          aria-label="Buscar caja por código"
          className="w-40 font-mono uppercase sm:w-56"
        />
      </form>
      <p className="hidden shrink-0 font-mono text-sm text-muted-foreground sm:block">{ahora}</p>
    </header>
  );
}
