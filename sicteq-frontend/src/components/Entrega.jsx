import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api';
import { bip } from '../sonido';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Entrega a pabellón (TENS): elegir el pedido, escanear la caja y despachar.
// Separada del vínculo con paciente, que es trabajo de Enfermería en pabellón.
const cajaPedida = (s) => s.caja_pedida || String(s.observaciones || '').match(/\[Instrumental Requerido:\s*([^\]]+)\]/)?.[1] || '—';
const hora = (d) => new Date(d).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function Entrega() {
  const [params, setParams] = useSearchParams();
  const elegido = params.get('solicitud');
  const [pedidos, setPedidos] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [estado, setEstado] = useState({ enviando: false, mensaje: '', ok: false });

  const cargar = useCallback(() => {
    apiFetch('/api/solicitudes?pendientes=1')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setPedidos(Array.isArray(d) ? d : []))
      .catch(() => setPedidos([]));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const pedido = pedidos?.find((p) => String(p.id) === elegido);
  // Urgencias primero, después el más antiguo: el orden en que se atienden en la Central.
  const cola = (pedidos || []).slice().sort((a, b) =>
    (/urgencia/i.test(b.tipo_cirugia) - /urgencia/i.test(a.tipo_cirugia)) || new Date(a.fecha_creacion) - new Date(b.fecha_creacion));

  const elegir = (id) => { setParams(id ? { solicitud: String(id) } : {}); setCodigo(''); setEstado({ enviando: false, mensaje: '', ok: false }); };

  const despachar = async (e) => {
    e.preventDefault();
    const caja = codigo.trim().toUpperCase();
    setCodigo(''); // la pistola escribe encima: cada escaneo parte con el campo vacío
    if (!caja || estado.enviando) return;
    setEstado({ enviando: true, mensaje: '', ok: false });
    try {
      const r = await apiFetch(`/api/solicitudes/${elegido}/despachar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caja_codigo: caja }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo registrar la entrega.');
      bip(true);
      setEstado({ enviando: false, mensaje: `${caja} entregada para REQ-${elegido}.`, ok: true });
      setPedidos((ps) => ps?.filter((p) => String(p.id) !== elegido));
      setParams({});
      cargar();
    } catch (err) {
      bip(false);
      setEstado({ enviando: false, mensaje: err.message, ok: false });
    }
  };

  const aviso = estado.mensaje && (
    <p role={estado.ok ? 'status' : 'alert'} className={cn('rounded-md border p-3 text-sm font-bold', estado.ok ? 'border-ok/40 bg-ok/15 text-ok' : 'border-danger/40 bg-danger/15 text-danger')}>
      {estado.mensaje}
    </p>
  );

  if (elegido) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-mono">REQ-{elegido}</CardTitle>
            <CardDescription>
              {pedido ? <>{cajaPedida(pedido)} · {pedido.area_nombre}</> : 'Cargando pedido…'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={despachar} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="caja-entrega">Escanee la caja que sale a pabellón</Label>
                <Input
                  id="caja-entrega"
                  autoFocus
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  placeholder="CAJA-0045"
                  className="h-14 font-mono text-xl uppercase tracking-widest"
                />
              </div>
              {aviso}
              <div className="grid grid-cols-3 gap-3">
                <Button variant="secondary" onClick={() => elegir(null)}>Volver</Button>
                <Button type="submit" size="lg" className="col-span-2" disabled={estado.enviando}>
                  {estado.enviando ? 'Registrando…' : 'Entregar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {aviso}
      <Card>
        <CardHeader>
          <CardTitle>Pedidos por entregar</CardTitle>
          <CardDescription>Urgencias primero. Elija el pedido y escanee la caja.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {pedidos === null && <p className="px-5 pb-5 text-sm text-muted-foreground">Cargando…</p>}
          {pedidos?.length === 0 && <p className="px-5 pb-5 text-sm text-muted-foreground">No hay pedidos por entregar.</p>}
          {cola.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
              <div className="min-w-0">
                <p className="font-bold">
                  <span className="font-mono">REQ-{p.id}</span> · {cajaPedida(p)}
                </p>
                <p className="text-sm text-muted-foreground">{p.area_nombre} · {hora(p.fecha_creacion)}</p>
              </div>
              <div className="flex items-center gap-3">
                {/urgencia/i.test(p.tipo_cirugia) && <Badge variant="danger">Urgencia</Badge>}
                <Button size="sm" onClick={() => elegir(p.id)}>Entregar</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
