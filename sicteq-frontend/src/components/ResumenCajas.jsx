import { useState } from 'react';
import { ETAPAS, etapaDe, nombreEstado, varianteEstado } from '@/etapas';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ResumenCajas({ cajas, cargando, error, onAbrir }) {
  const [etapa, setEtapa] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const grupos = [...ETAPAS, { id: 0, nombre: 'Sin etapa registrada' }].map((e) => ({
    ...e, cantidad: cajas.filter((c) => (etapaDe(c.estado_nuevo) || 0) === e.id).length,
  }));
  const visibles = cajas.filter((c) => (etapa === null || (etapaDe(c.estado_nuevo) || 0) === etapa)
    && `${c.codigo_caja} ${c.nombre_equipo} ${c.destino_nombre || ''}`.toLocaleLowerCase('es-CL').includes(busqueda.toLocaleLowerCase('es-CL')));

  return (
    <Card>
      <CardHeader>
        <CardTitle>¿Dónde están las cajas?</CardTitle>
        <CardDescription>Distribución actual de las cajas en circulación. Toque una etapa para ver sus cajas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? <p role="alert" className="text-danger">{error}</p> : cargando ? <p role="status">Cargando ubicación de las cajas…</p> : <>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label={`Distribución de ${cajas.length} cajas`}>
            {grupos.filter((e) => e.id || e.cantidad).map((e) => (
              <button key={e.id} aria-pressed={etapa === e.id} onClick={() => { setEtapa(etapa === e.id ? null : e.id); setMostrar(true); }}
                className={`rounded-lg border p-3 text-left transition-colors ${etapa === e.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                <span className="flex justify-between gap-3 text-sm font-bold"><span>{e.nombre}</span><span className="font-mono">{e.cantidad}</span></span>
                <span className="mt-2 block h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true"><span className={`block h-full rounded-full ${e.id === 5 ? 'bg-ok' : 'bg-primary'}`} style={{ width: `${cajas.length ? e.cantidad / cajas.length * 100 : 0}%` }} /></span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{cajas.length} cajas en circulación</p>
            <Button variant="secondary" aria-expanded={mostrar} onClick={() => { setMostrar(!mostrar); setEtapa(null); }}>{mostrar ? 'Ocultar listado' : 'Buscar en todas las cajas'}</Button>
          </div>
          {mostrar && <div className="space-y-3">
            <Input aria-label="Filtrar cajas por código, tipo o ubicación" placeholder="Buscar código, tipo o ubicación…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            <div className="flex flex-wrap items-center gap-3"><p role="status" className="text-sm text-muted-foreground">{visibles.length} cajas{etapa !== null ? ` · ${grupos.find((e) => e.id === etapa)?.nombre}` : ''}</p>{etapa !== null && <Button size="sm" variant="ghost" onClick={() => setEtapa(null)}>Ver todas las etapas</Button>}</div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {visibles.map((c) => <button key={c.id} onClick={() => onAbrir(c.codigo_caja)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-left hover:bg-muted">
                <span><span className="block font-mono font-bold">{c.codigo_caja}</span><span className="text-sm text-muted-foreground">{c.nombre_equipo} · {c.destino_nombre || 'Sin ubicación registrada'}</span></span>
                <Badge variant={varianteEstado(c.estado_nuevo)}>{nombreEstado(c.estado_nuevo)}</Badge>
              </button>)}
              {!visibles.length && <p className="p-3 text-muted-foreground">No hay cajas para esta búsqueda.</p>}
            </div>
          </div>}
        </>}
      </CardContent>
    </Card>
  );
}
