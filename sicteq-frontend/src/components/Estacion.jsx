import { useRef, useState } from 'react';
import { apiFetch, moverCaja } from '../api';
import { bip } from '../sonido';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Label } from '@/components/ui/input';
import { nombreEstado, etapaDe } from '@/etapas';
import { cn } from '@/lib/utils';

// Modo estación: el TENS elige dónde está parado y escanea caja tras caja; cada
// escaneo mueve la caja a esa etapa sin más clics. Esterilización no es estación
// (la caja entra por una carga de autoclave) y la entrega sale desde un pedido.
const ESTACIONES = [
  { etapa: 1, nombre: 'Recepción', llegaDesde: [6, null], motivo: 'Recepción desde pabellón' },
  { etapa: 2, nombre: 'Lavado', llegaDesde: [1] },
  { etapa: 3, nombre: 'Preparación', llegaDesde: [2] },
  { etapa: 5, nombre: 'Bodega estéril', llegaDesde: [4] },
];

export default function Estacion() {
  const [estacion, setEstacion] = useState(ESTACIONES[0]);
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [registro, setRegistro] = useState([]);
  const campo = useRef(null);

  const anotar = (caja, ok, texto) => {
    bip(ok);
    setRegistro((r) => [{ id: Date.now(), caja, ok, texto, hora: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) }, ...r].slice(0, 30));
  };

  const escanear = async (e) => {
    e.preventDefault();
    const caja = codigo.trim().toUpperCase();
    setCodigo('');
    if (!caja || ocupado) return;
    setOcupado(true);
    try {
      const r = await apiFetch(`/api/trazabilidad/buscar/${encodeURIComponent(caja)}`);
      const hist = await r.json().catch(() => ({}));
      if (!r.ok) return anotar(caja, false, hist.message || hist.error || 'Caja no encontrada.');
      const ultimo = Array.isArray(hist) ? hist[0]?.estado_nuevo : null;
      const actual = etapaDe(ultimo);
      if (actual === estacion.etapa) return anotar(caja, false, `Ya estaba en ${estacion.nombre}.`);
      if (!estacion.llegaDesde.includes(actual)) {
        const desde = estacion.llegaDesde.filter(Boolean).map((n) => nombreEstado(`Etapa ${n}`)).join(' o ');
        return anotar(caja, false, `Está en ${nombreEstado(ultimo)}; a ${estacion.nombre} llega desde ${desde}.`);
      }
      const res = await moverCaja(caja, estacion.etapa, estacion.motivo);
      anotar(caja, res.ok, res.ok ? `Pasó a ${estacion.nombre}.` : res.mensaje || 'No se pudo registrar.');
    } catch {
      anotar(caja, false, 'Sin conexión con el servidor.');
    } finally {
      setOcupado(false);
      campo.current?.focus();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-5">
          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Estoy en</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
              {ESTACIONES.map((s) => (
                <button
                  key={s.etapa}
                  type="button"
                  role="radio"
                  aria-checked={estacion.etapa === s.etapa}
                  onClick={() => { setEstacion(s); campo.current?.focus(); }}
                  className={cn('h-12 rounded-md border font-bold transition-colors', estacion.etapa === s.etapa ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted')}
                >
                  {s.nombre}
                </button>
              ))}
            </div>
          </fieldset>
          <form onSubmit={escanear} className="space-y-1.5">
            <Label htmlFor="escaneo-estacion">Escanee las cajas una tras otra: cada una pasa a {estacion.nombre}</Label>
            <Input
              id="escaneo-estacion"
              ref={campo}
              autoFocus
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="CAJA-0045"
              className="h-14 font-mono text-xl uppercase tracking-widest"
            />
          </form>
        </CardContent>
      </Card>

      {registro.length === 0 ? (
        <p className="text-muted-foreground">Cada escaneo suena: un bip agudo si quedó registrado, dos graves si hay que revisarlo.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            {registro.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 first:border-t-0">
                <div className="min-w-0">
                  <p className="font-mono font-bold">{r.caja}</p>
                  <p className={cn('text-sm', r.ok ? 'text-muted-foreground' : 'font-bold text-danger')}>{r.texto}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{r.hora}</span>
                  <Badge variant={r.ok ? 'ok' : 'danger'}>{r.ok ? 'Listo' : 'Revisar'}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
