import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea, Label } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// PB-04: registro de cargas de autoclave. Identificador de la carga =
// N° de autoclave + N° de ciclo (el mismo del voucher de la máquina).
const METODOS = ['Autoclave', 'Óxido de Etileno', 'Plasma de Peróxido de Hidrógeno'];
const PUEDEN_LIBERAR = ['Enfermera', 'IT'];
const FORM_INICIAL = { numero_maquina: '1', numero_ciclo: '', metodo: METODOS[0], temperatura: '', presion: '', tiempo_minutos: '' };

const fmt = (d) => d ? new Date(d).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
const parametros = (c, conPresion) => [c.temperatura && `${c.temperatura} °C`, conPresion && c.presion, c.tiempo_minutos && `${c.tiempo_minutos} min`].filter(Boolean).join(' · ') || '—';
const idCarga = (c) => `M${c.numero_maquina}-C${c.numero_ciclo}`;
const VARIANTE = { 'En proceso': 'warn', 'Estéril': 'ok', 'No estéril': 'danger' };

const leerError = async (res) => (await res.json().catch(() => ({}))).error || `Error del servidor (${res.status})`;

function Aviso({ aviso }) {
  if (!aviso) return null;
  const ok = aviso.tipo === 'ok';
  return (
    <p role={ok ? 'status' : 'alert'} className={cn('rounded-md border p-3 text-sm font-bold', ok ? 'border-ok/40 bg-ok/15 text-ok' : 'border-danger/40 bg-danger/15 text-danger')}>
      {aviso.texto}
    </p>
  );
}

export default function Autoclave({ user }) {
  const [form, setForm] = useState(FORM_INICIAL);
  const [codigo, setCodigo] = useState('');
  const [cajas, setCajas] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const [ciclos, setCiclos] = useState([]);
  const [filtro, setFiltro] = useState({ maquina: '', numero: '' });
  const [detalle, setDetalle] = useState(null);
  const [modoNoEsteril, setModoNoEsteril] = useState(false);
  const [observacion, setObservacion] = useState('');
  const [avisoDetalle, setAvisoDetalle] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mostrar, setMostrar] = useState(20); // cargas visibles en la lista
  const refDetalle = useRef(null);

  // Al tocar una carga, su detalle queda a la vista aunque la lista sea larga.
  useEffect(() => {
    if (detalle?.id) refDetalle.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [detalle?.id]);

  const cargarCiclos = useCallback(async (f = { maquina: '', numero: '' }) => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== '')).toString();
    const res = await apiFetch(`/api/ciclos${qs ? `?${qs}` : ''}`);
    if (res.ok) setCiclos(await res.json());
  }, []);

  useEffect(() => {
    apiFetch('/api/ciclos').then(r => (r.ok ? r.json() : [])).then(setCiclos).catch(() => {});
  }, []);

  // El aviso se fija recién cuando llega el detalle, para no mostrar un estado intermedio.
  const abrirDetalle = async (id, avisoFinal = null) => {
    const res = await apiFetch(`/api/ciclos/${id}`);
    setModoNoEsteril(false);
    setObservacion('');
    if (res.ok) { setDetalle(await res.json()); setAvisoDetalle(avisoFinal); }
    else setAvisoDetalle({ tipo: 'error', texto: await leerError(res) });
  };

  // El lector de código de barras USB escribe el código y manda Enter.
  const agregarCaja = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const c = codigo.trim().toUpperCase();
    if (c && !cajas.includes(c)) setCajas([...cajas, c]);
    setCodigo('');
  };

  const registrar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    if (cajas.length === 0) { setAviso({ tipo: 'error', texto: 'Agrega al menos una caja a la carga (escribe o escanea el código y presiona Enter).' }); return; }
    setEnviando(true);
    setAviso(null);
    try {
      const res = await apiFetch('/api/ciclos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, numero_maquina: Number(form.numero_maquina), numero_ciclo: Number(form.numero_ciclo), cajas }),
      });
      if (!res.ok) throw new Error(await leerError(res));
      const data = await res.json();
      setAviso({ tipo: 'ok', texto: `Carga ${data.identificador} registrada con ${cajas.length} caja(s). Queda En proceso hasta que Enfermería registre el resultado.` });
      setForm({ ...FORM_INICIAL, numero_maquina: form.numero_maquina, metodo: form.metodo });
      setCajas([]);
      cargarCiclos(filtro);
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.message });
    } finally {
      setEnviando(false);
    }
  };

  const registrarResultado = async (resultado) => {
    if (resultado === 'No estéril' && !observacion.trim()) {
      setAvisoDetalle({ tipo: 'error', texto: 'Escribe la causa de la carga No estéril.' });
      return;
    }
    if (guardando) return;
    setGuardando(true);
    try {
      const res = await apiFetch(`/api/ciclos/${detalle.id}/resultado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultado, observacion }),
      });
      if (!res.ok) { setAvisoDetalle({ tipo: 'error', texto: await leerError(res) }); return; }
      cargarCiclos(filtro);
      await abrirDetalle(detalle.id, { tipo: 'ok', texto: resultado === 'Estéril' ? 'Carga liberada como Estéril.' : 'Carga marcada No estéril: sus cajas volvieron a Lavado.' });
    } finally {
      setGuardando(false);
    }
  };

  const puedeLiberar = PUEDEN_LIBERAR.includes(user?.role);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <p className="max-w-3xl text-muted-foreground">Cada carga se identifica como en el voucher de la máquina: <span className="font-mono text-foreground">M</span> + N° de autoclave y <span className="font-mono text-foreground">C</span> + N° de ciclo. Solo entran cajas en Lavado o Preparación. Si la carga sale No estéril, sus cajas vuelven a Lavado.</p>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Nueva carga */}
        <Card className="h-fit xl:col-span-2">
          <CardHeader>
            <CardTitle>Nueva carga</CardTitle>
            <CardDescription>Escanee cada caja con la pistola o escriba el código y presione Enter.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={registrar} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="maquina">Autoclave</Label>
                  <Select id="maquina" value={form.numero_maquina} onChange={(e) => setForm({ ...form, numero_maquina: e.target.value })}>
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>Autoclave {n}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ciclo">N° de ciclo</Label>
                  <Input id="ciclo" required type="number" min="1" className="font-mono" value={form.numero_ciclo} onChange={(e) => setForm({ ...form, numero_ciclo: e.target.value })} placeholder="145" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="metodo">Método</Label>
                <Select id="metodo" value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value })}>
                  {METODOS.map(m => <option key={m}>{m}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="temp">°C</Label>
                  <Input id="temp" type="number" step="0.1" className="font-mono" value={form.temperatura} onChange={(e) => setForm({ ...form, temperatura: e.target.value })} placeholder="134" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="presion">Presión</Label>
                  <Input id="presion" className="font-mono" value={form.presion} onChange={(e) => setForm({ ...form, presion: e.target.value })} placeholder="2.1 bar" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="minutos">Minutos</Label>
                  <Input id="minutos" type="number" min="1" className="font-mono" value={form.tiempo_minutos} onChange={(e) => setForm({ ...form, tiempo_minutos: e.target.value })} placeholder="18" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="codigo-caja">Cajas de la carga</Label>
                <Input id="codigo-caja" className="font-mono uppercase tracking-wider" value={codigo} onChange={(e) => setCodigo(e.target.value)} onKeyDown={agregarCaja} placeholder="Escanear: CAJA-0001" />
              </div>
              <div className="flex min-h-9 flex-wrap gap-2">
                {cajas.length === 0 && <span className="text-sm text-muted-foreground">Todavía no hay cajas en esta carga.</span>}
                {cajas.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 py-1 pl-3 pr-1 font-mono text-sm font-bold text-primary">
                    {c}
                    <button type="button" aria-label={`Quitar ${c}`} onClick={() => setCajas(cajas.filter(x => x !== c))} className="flex h-7 w-7 items-center justify-center rounded hover:bg-danger/20 hover:text-danger">
                      <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                    </button>
                  </span>
                ))}
              </div>
              {/* El aviso va junto al botón: es donde está mirando quien acaba de registrar. */}
              <Aviso aviso={aviso} />
              <Button type="submit" size="lg" disabled={enviando} className="w-full">
                {enviando ? <><i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Registrando…</> : <>Registrar carga · {cajas.length} caja{cajas.length === 1 ? '' : 's'}</>}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Listado + detalle */}
        <div className="space-y-6 xl:col-span-3">
          {detalle && (
            <Card ref={refDetalle} className="scroll-mt-4 border-primary/50">
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="font-mono text-2xl">{detalle.identificador}</CardTitle>
                  <CardDescription className="font-mono">{detalle.metodo} · {parametros(detalle, true)}<br />Inicio {fmt(detalle.fecha_inicio)} · Fin {fmt(detalle.fecha_fin)}</CardDescription>
                  {detalle.observacion && <p className="pt-1 text-sm">Observación: {detalle.observacion}</p>}
                </div>
                <Badge variant={VARIANTE[detalle.estado]} className="px-3 py-1 text-sm">{detalle.estado}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <Aviso aviso={avisoDetalle} />
                <ul className="divide-y divide-border rounded-md border border-border">
                  {detalle.cajas.map(c => (
                    <li key={c.codigo_caja} className="flex items-center justify-between gap-3 p-3">
                      <span><span className="font-mono font-bold">{c.codigo_caja}</span> <span className="text-muted-foreground">{c.nombre_equipo}</span></span>
                      <span className="text-sm text-muted-foreground">{c.resultado}</span>
                    </li>
                  ))}
                </ul>

                {detalle.estado === 'En proceso' && (puedeLiberar ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button variant="ok" size="lg" disabled={guardando} onClick={() => registrarResultado('Estéril')}>Liberar como Estéril</Button>
                      <Button variant="outline" size="lg" className="border-danger/60 text-danger hover:bg-danger/10" onClick={() => setModoNoEsteril(true)}>Marcar No estéril</Button>
                    </div>
                    {modoNoEsteril && (
                      <div className="space-y-3 rounded-md border border-danger/40 bg-danger/10 p-4">
                        <p className="text-sm font-bold text-danger">Las cajas de esta carga vuelven a Lavado y quedan bloqueadas hasta una nueva carga Estéril.</p>
                        <Label htmlFor="causa">Causa (obligatoria)</Label>
                        <Textarea id="causa" value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Ej.: corte de luz durante el ciclo" />
                        <Button variant="destructive" disabled={guardando} onClick={() => registrarResultado('No estéril')}>{guardando ? 'Guardando…' : 'Confirmar No estéril'}</Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">Solo Enfermería puede liberar o rechazar la carga.</p>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Cargas registradas</CardTitle>
              <CardDescription>Toque una carga para ver sus cajas y registrar el resultado.</CardDescription>
            </CardHeader>
            <div className="flex flex-wrap gap-3 px-5 pb-4">
              <Input type="number" min="1" className="w-32 font-mono" placeholder="Autoclave" aria-label="Filtrar por autoclave" value={filtro.maquina} onChange={(e) => setFiltro({ ...filtro, maquina: e.target.value })} />
              <Input type="number" min="1" className="w-32 font-mono" placeholder="N° ciclo" aria-label="Filtrar por número de ciclo" value={filtro.numero} onChange={(e) => setFiltro({ ...filtro, numero: e.target.value })} />
              <Button variant="secondary" onClick={() => cargarCiclos(filtro)}>Buscar</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Carga</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Parámetros</TableHead>
                  <TableHead className="text-center">Cajas</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Operador</TableHead>
                  <TableHead>Inicio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ciclos.length === 0 && (
                  <TableRow className="hover:bg-transparent"><TableCell colSpan="6" className="py-8 text-center text-muted-foreground">No hay cargas registradas.</TableCell></TableRow>
                )}
                {ciclos.slice(0, mostrar).map(c => (
                  <TableRow key={c.id} onClick={() => abrirDetalle(c.id)} className={cn('cursor-pointer', detalle?.id === c.id && 'bg-primary/10 hover:bg-primary/10')}>
                    <TableCell className="whitespace-nowrap font-mono font-bold">{idCarga(c)}</TableCell>
                    <TableCell><Badge variant={VARIANTE[c.estado]}>{c.estado}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-muted-foreground">{parametros(c, false)}</TableCell>
                    <TableCell className="text-center font-mono font-bold">{c.cantidad_cajas}</TableCell>
                    <TableCell className="hidden text-muted-foreground 2xl:table-cell">{c.operador || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-muted-foreground">{fmt(c.fecha_inicio)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {ciclos.length > mostrar && (
              <div className="border-t border-border p-4 text-center">
                <Button variant="secondary" onClick={() => setMostrar(mostrar + 20)}>Ver 20 más · quedan {ciclos.length - mostrar}</Button>
              </div>
            )}
          </Card>

        </div>
      </div>
    </div>
  );
}
