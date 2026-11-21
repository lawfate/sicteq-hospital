import { useRef, useState } from 'react';
import { apiFetch, moverCaja, fichaCaja } from '../api';
import { bip } from '../sonido';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { nombreEstado, etapaDe } from '@/etapas';
import { cn } from '@/lib/utils';

// Modo estación: el TENS elige dónde está parado y escanea caja tras caja; cada
// escaneo mueve la caja a esa etapa sin más clics. Esterilización no es estación
// (la caja entra por una carga de autoclave) y la entrega sale desde un pedido.
// Recepción pide contar las piezas (faltante = incidencia); en Bodega estéril,
// después de las cajas se escanea el estante (EST-…) donde quedaron.
const ESTACIONES = [
  { etapa: 1, nombre: 'Recepción', llegaDesde: [6, null], motivo: 'Recepción desde pabellón', cuenta: true },
  { etapa: 2, nombre: 'Lavado', llegaDesde: [1] },
  { etapa: 3, nombre: 'Preparación', llegaDesde: [2] },
  { etapa: 5, nombre: 'Bodega estéril', llegaDesde: [4], estantes: true },
];

export default function Estacion() {
  const [estacion, setEstacion] = useState(ESTACIONES[0]);
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [registro, setRegistro] = useState([]);
  const [conteo, setConteo] = useState(null); // { caja, tipo, piezas, contadas } esperando confirmar
  const [sinEstante, setSinEstante] = useState([]); // cajas recién guardadas, falta escanear su estante
  const campo = useRef(null);

  const anotar = (caja, ok, texto, aviso = false) => {
    bip(ok && !aviso);
    setRegistro((r) => [{ id: `${Date.now()}-${caja}`, caja, ok, aviso, texto, hora: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) }, ...r].slice(0, 30));
  };
  const enfocar = () => setTimeout(() => campo.current?.focus(), 0);

  const cambiarEstacion = (s) => { setEstacion(s); setConteo(null); setSinEstante([]); enfocar(); };

  const mover = async (caja, extra) => {
    const res = await moverCaja(caja, estacion.etapa, estacion.motivo, extra);
    if (!res.ok) return anotar(caja, false, res.mensaje || 'No se pudo registrar.');
    if (res.incidencia) return anotar(caja, true, `Recibida con piezas faltantes (${extra.piezasContadas} de ${conteo?.piezas}). Quedó una incidencia en el Panel.`, true);
    anotar(caja, true, `Pasó a ${estacion.nombre}.`);
    if (estacion.estantes) setSinEstante((l) => [...l, caja]);
  };

  const ubicar = async (estante) => {
    if (sinEstante.length === 0) return anotar(estante, false, 'Primero escanee las cajas que va a guardar en este estante.');
    for (const caja of sinEstante) {
      const r = await apiFetch(`/api/cajas/${encodeURIComponent(caja)}/estante`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estante }),
      });
      const d = await r.json().catch(() => ({}));
      anotar(caja, r.ok, r.ok ? `Guardada en ${estante}.` : d.error || 'No se pudo registrar el estante.');
    }
    setSinEstante([]);
  };

  const escanear = async (e) => {
    e.preventDefault();
    const caja = codigo.trim().toUpperCase();
    setCodigo('');
    if (!caja) return;
    // La pistola puede ser más rápida que el servidor: avisar en vez de perder el escaneo.
    if (ocupado || conteo) return anotar(caja, false, 'Escaneo muy rápido: espere el bip de la caja anterior y vuelva a escanearla.');
    setOcupado(true);
    try {
      if (/^EST-/.test(caja)) {
        if (!estacion.estantes) return anotar(caja, false, 'Los estantes se escanean en Bodega estéril.');
        return await ubicar(caja);
      }
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
      if (estacion.cuenta) {
        const ficha = await fichaCaja(caja);
        if (ficha?.piezas) {
          setConteo({ caja, tipo: ficha.tipo, piezas: ficha.piezas, contadas: String(ficha.piezas) });
          return;
        }
      }
      await mover(caja);
    } catch {
      anotar(caja, false, 'Sin conexión con el servidor.');
    } finally {
      setOcupado(false);
      enfocar();
    }
  };

  const confirmarConteo = async (e) => {
    e.preventDefault();
    const n = Number(conteo.contadas);
    if (!/^\d{1,3}$/.test(conteo.contadas) || n > conteo.piezas) return;
    setOcupado(true);
    try {
      await mover(conteo.caja, { piezasContadas: n });
    } catch {
      anotar(conteo.caja, false, 'Sin conexión con el servidor.');
    } finally {
      setConteo(null);
      setOcupado(false);
      enfocar();
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
                  onClick={() => cambiarEstacion(s)}
                  className={cn('h-12 rounded-md border font-bold transition-colors', estacion.etapa === s.etapa ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted')}
                >
                  {s.nombre}
                </button>
              ))}
            </div>
          </fieldset>

          {conteo ? (
            <form onSubmit={confirmarConteo} className="space-y-3 rounded-md border border-primary/40 bg-primary/10 p-4">
              <p className="font-bold"><span className="font-mono">{conteo.caja}</span> · {conteo.tipo}</p>
              <Label htmlFor="piezas-contadas">Piezas contadas (trae {conteo.piezas}). Si está completa, presione Enter.</Label>
              <div className="flex gap-3">
                <Input
                  id="piezas-contadas"
                  autoFocus
                  inputMode="numeric"
                  value={conteo.contadas}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setConteo({ ...conteo, contadas: e.target.value.replace(/\D/g, '') })}
                  className="h-14 w-32 font-mono text-2xl"
                />
                <Button type="submit" size="lg" className="flex-1" disabled={ocupado || Number(conteo.contadas) > conteo.piezas || conteo.contadas === ''}>
                  {Number(conteo.contadas) < conteo.piezas ? `Recibir con ${conteo.piezas - Number(conteo.contadas)} faltante(s)` : 'Recibir completa'}
                </Button>
                <Button variant="ghost" onClick={() => { setConteo(null); enfocar(); }}>Cancelar</Button>
              </div>
            </form>
          ) : (
            <form onSubmit={escanear} className="space-y-1.5">
              <Label htmlFor="escaneo-estacion">
                {estacion.estantes
                  ? 'Escanee las cajas que guarda y después el estante (EST-…) donde quedaron'
                  : `Escanee las cajas una tras otra: cada una pasa a ${estacion.nombre}`}
              </Label>
              <Input
                id="escaneo-estacion"
                ref={campo}
                autoFocus
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder={estacion.estantes ? 'CAJA-0045 o EST-B2' : 'CAJA-0045'}
                className="h-14 font-mono text-xl uppercase tracking-widest"
              />
            </form>
          )}

          {sinEstante.length > 0 && (
            <p className="rounded-md border border-warn/40 bg-warn/15 p-3 text-sm font-bold text-warn">
              Falta el estante de: <span className="font-mono">{sinEstante.join(', ')}</span>. Escanee la etiqueta del estante.
            </p>
          )}
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
                  <p className={cn('text-sm', !r.ok ? 'font-bold text-danger' : r.aviso ? 'font-bold text-warn' : 'text-muted-foreground')}>{r.texto}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{r.hora}</span>
                  <Badge variant={!r.ok ? 'danger' : r.aviso ? 'warn' : 'ok'}>{!r.ok ? 'Revisar' : r.aviso ? 'Incidencia' : 'Listo'}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
