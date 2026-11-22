import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import ResumenCajas from './ResumenCajas';
import { apiFetch } from '../api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { nombreEstado, varianteEstado } from '@/etapas';

// Las solicitudes guardan "[Instrumental Requerido: Set X] - nota": se muestra solo el set.
const cajaPedida = (texto) => String(texto || '').match(/\[Instrumental Requerido:\s*([^\]]+)\]/)?.[1] || texto || '—';

// Lo que cada rol hace a diario, a un clic desde el Panel.
const ACCIONES = {
  TENS: [
    { ruta: '/ciclo?modo=registrar', texto: 'Recibir o mover una caja', icono: 'fa-barcode' },
    { ruta: '/autoclave', texto: 'Armar carga de autoclave', icono: 'fa-temperature-high' },
    { ruta: '/entrega', texto: 'Entregar pedidos de pabellón', icono: 'fa-truck-medical' },
    { ruta: '/etiquetas', texto: 'Imprimir etiquetas', icono: 'fa-tags' },
  ],
  Enfermera: [
    { ruta: '/solicitudes', texto: 'Pedir caja para cirugía', icono: 'fa-clipboard-list' },
    { ruta: '/autoclave', texto: 'Liberar cargas de autoclave', icono: 'fa-check-double' },
    { ruta: '/vinculo', texto: 'Vincular caja con paciente', icono: 'fa-hand-holding-medical' },
    { ruta: '/indicadores', texto: 'Ver indicadores', icono: 'fa-gauge-high' },
  ],
  IT: [
    { ruta: '/auditoria', texto: 'Revisar auditoría', icono: 'fa-user-shield' },
    { ruta: '/reportes', texto: 'Exportar reportes', icono: 'fa-file-lines' },
    { ruta: '/indicadores', texto: 'Ver indicadores', icono: 'fa-gauge-high' },
    { ruta: '/inventario', texto: 'Revisar inventario', icono: 'fa-boxes-stacked' },
  ],
};

const fecha = (d) => new Date(d).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function Dashboard({ user, onTour }) {
  const navigate = useNavigate();
  const puedeEntregar = ['TENS', 'IT'].includes(user?.role);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', items: [] });
  const [data, setData] = useState({
    stats: { en_proceso: 0, total_equipos: 0, alertas_stock: 0, solicitudes_pendientes: 0 },
    movimientos: [],
    criticas: []
  });
  const [cajasCirculacion, setCajasCirculacion] = useState([]);
  const [cargandoCajas, setCargandoCajas] = useState(true);
  const [errores, setErrores] = useState({});
  const [recarga, setRecarga] = useState(0);
  // null = todavía cargando (antes mostraba "Sin alertas" mientras llegaba la respuesta).
  const [alertas, setAlertas] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [resolviendo, setResolviendo] = useState(null); // { id, texto, error }

  useEffect(() => {
    const control = new AbortController();
    const cargar = async (ruta) => {
      const res = await apiFetch(ruta, { signal: control.signal });
      if (!res.ok) throw new Error('No se pudo cargar la información.');
      return res.json();
    };
    const fallar = (clave) => (err) => { if (err.name !== 'AbortError') setErrores((e) => ({ ...e, [clave]: 'No se pudo cargar esta información. Intente actualizar el Panel.' })); };
    cargar('/api/dashboard')
      .then(json => setData(json))
      .catch(fallar('panel'))
      .finally(() => setCargando(false));

    cargar('/api/cajas/circulacion')
      .then(json => setCajasCirculacion(Array.isArray(json) ? json : []))
      .catch(fallar('cajas'))
      .finally(() => setCargandoCajas(false));

    cargar('/api/alertas')
      .then(json => setAlertas({
        stockBajo: Array.isArray(json.stockBajo) ? json.stockBajo : [],
        cajasPorVencer: Array.isArray(json.cajasPorVencer) ? json.cajasPorVencer : [],
        cargasDemoradas: Array.isArray(json.cargasDemoradas) ? json.cargasDemoradas : [],
        incidencias: Array.isArray(json.incidencias) ? json.incidencias : []
      }))
      .catch(fallar('alertas'));
    return () => control.abort();
  }, [recarga]);

  const abrirDetalles = async (mov) => {
    try {
      if (!mov.inventario_id) {
        setModalContent({
          title: `Historial: ${mov.justificacion}`,
          items: [],
          emptyMessage: 'Este movimiento no tiene una caja de inventario asociada, así que no hay historial adicional que mostrar.'
        });
        setIsModalOpen(true);
        return;
      }
      const response = await apiFetch(`/api/dashboard/movimientos/${mov.inventario_id}`);
      if (!response.ok) throw new Error('Historial no disponible');
      const historial = await response.json();
      setModalContent({ title: `Historial: ${mov.justificacion}`, items: historial });
      setIsModalOpen(true);
    } catch {
      setErrores((e) => ({ ...e, historial: 'No se pudo abrir el historial. Inténtelo nuevamente.' }));
    }
  };

  const resumen = [
    { titulo: 'En proceso', valor: data.stats.en_proceso, nota: 'Recepción a esterilización' },
    { titulo: 'Listas o en pabellón', valor: data.stats.total_equipos, nota: 'En bodega estéril o entregadas' },
    { titulo: 'Pedidos pendientes', valor: data.stats.solicitudes_pendientes, nota: `${data.stats.solicitudes_urgentes ?? '–'} urgentes · aún no entregados`, alerta: data.stats.solicitudes_pendientes > 0 },
    { titulo: 'Stock en alerta', valor: data.stats.alertas_stock, nota: 'Tipos de caja bajo el mínimo', alerta: data.stats.alertas_stock > 0 },
  ];
  const hayAlertas = alertas && (alertas.stockBajo.length > 0 || alertas.cajasPorVencer.length > 0 || alertas.cargasDemoradas.length > 0 || alertas.incidencias.length > 0);
  const puedeResolver = ['Enfermera', 'IT'].includes(user?.role);

  const resolver = async (id) => {
    if (resolviendo.enviando) return;
    setResolviendo({ ...resolviendo, enviando: true, error: '' });
    try {
    const r = await apiFetch(`/api/incidencias/${id}/resolver`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolucion: resolviendo.texto }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'No se pudo registrar.');
    setResolviendo(null);
    setAlertas((a) => ({ ...a, incidencias: a.incidencias.filter((i) => i.id !== id) }));
    } catch (err) {
      setResolviendo({ ...resolviendo, enviando: false, error: err.message || 'Revise la conexión e intente nuevamente.' });
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card p-5 sm:p-6">
        <div className="space-y-1"><p className="text-sm font-bold text-primary">Central de Esterilización</p><h1 className="text-2xl font-bold sm:text-3xl">Hola, {user?.name?.split(' ')[0] || 'bienvenido'}</h1><p className="text-muted-foreground">Elija una tarea o revise lo que necesita atención.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={onTour}><i className="fa-solid fa-route" aria-hidden="true" />Repetir recorrido</Button><Button variant="ghost" disabled={cargando || cargandoCajas} onClick={() => { setErrores({}); setCargando(true); setCargandoCajas(true); setAlertas(null); setRecarga((r) => r + 1); }}>Actualizar Panel</Button></div>
      </section>
      {(errores.panel || errores.historial) && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-danger">{errores.panel || errores.historial}</p>}
      {ACCIONES[user?.role] && (
        <section aria-label="Acciones rápidas" className="space-y-3">
          <h2 className="text-xl font-bold">¿Qué necesita hacer?</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ACCIONES[user.role].map((a) => (
            <button
              key={a.texto}
              className="group flex min-h-24 items-center gap-4 rounded-xl border border-primary/30 bg-card p-4 text-left font-bold transition-colors hover:border-primary hover:bg-primary/10"
              onClick={() => navigate(a.ruta)}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xl text-primary"><i className={`fa-solid ${a.icono}`} aria-hidden="true" /></span><span className="flex-1">{a.texto}</span><i className="fa-solid fa-chevron-right text-xs text-muted-foreground" aria-hidden="true" />
            </button>
          ))}
          </div>
        </section>
      )}

      {/* Resumen: cuatro números, sin adornos, legibles a distancia */}
      <section aria-label="Resumen" className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-4">
        {resumen.map((r, i) => (
          <div key={r.titulo} className={`space-y-1 p-5 ${i > 0 ? 'border-l border-border' : ''} ${i === 2 ? 'max-lg:border-l-0 max-lg:border-t' : ''} ${i === 3 ? 'max-lg:border-t' : ''}`}>
            <p className="text-sm font-bold text-muted-foreground">{r.titulo}</p>
            <p className={`font-mono text-4xl font-bold tabular-nums ${r.alerta ? 'text-warn' : 'text-primary'}`}>{cargando || errores.panel ? '–' : (r.valor || 0)}</p>
            <p className="text-xs text-muted-foreground">{r.nota}</p>
          </div>
        ))}
      </section>

      {/* Pedidos de pabellón por atender */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Pedidos de pabellón por atender</CardTitle><Button variant="secondary" onClick={() => navigate(puedeEntregar ? '/entrega' : '/solicitudes')}>Ver todos los pedidos</Button></div>
          <CardDescription>
            Hasta 5 pendientes: urgencias primero y luego los más antiguos.{puedeEntregar && ' Entregar abre el pedido listo para trabajar.'}
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Pedido</TableHead>
              <TableHead>Pabellón</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Caja pedida</TableHead>
              <TableHead>Estado</TableHead>
              {puedeEntregar && <TableHead className="text-right">Acción</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.criticas.map((c) => (
              <TableRow key={c.solicitud_id}>
                <TableCell className="whitespace-nowrap font-mono font-bold">REQ-{c.solicitud_id}</TableCell>
                <TableCell className="font-bold">{c.pabellon}</TableCell>
                <TableCell>
                    <Badge variant={/urgen/i.test(c.tipo_cirugia || '') ? 'danger' : 'default'}>{c.tipo_cirugia}</Badge>
                </TableCell>
                <TableCell className="max-w-xs">{cajaPedida(c.caja_requerida)}</TableCell>
                <TableCell><Badge variant="info">{c.estado_actual}</Badge></TableCell>
                {puedeEntregar && (
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => navigate(`/entrega?solicitud=${c.solicitud_id}`)}>Entregar</Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {data.criticas.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={puedeEntregar ? 6 : 5} className="py-8 text-center text-muted-foreground">{cargando ? 'Cargando pedidos…' : errores.panel ? 'Pedidos no disponibles. Actualice el Panel.' : 'No hay pedidos pendientes.'}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <ResumenCajas cajas={cajasCirculacion} cargando={cargandoCajas} error={errores.cajas} onAbrir={(codigo) => navigate(`/ciclo?codigo=${encodeURIComponent(codigo)}`)} />

      {/* Lo que requiere atención */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Requiere atención</h2>
        {errores.alertas ? <p role="alert" className="text-danger">{errores.alertas}</p> : alertas === null ? (
          <p className="text-sm text-muted-foreground"><i className="fa-solid fa-circle-notch fa-spin mr-2" aria-hidden="true"></i>Revisando stock y vencimientos…</p>
        ) : !hayAlertas ? (
          <p className="rounded-lg border border-ok/40 bg-ok/10 px-5 py-4 font-bold text-ok">Todo en orden: no hay stock bajo, empaques por vencer, cargas demoradas ni piezas faltantes.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {alertas.incidencias.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>Cajas con piezas faltantes</CardTitle>
                    <CardDescription>Se detectaron al contar en Recepción.{puedeResolver ? ' Al resolver, anote qué se hizo.' : ''}</CardDescription>
                  </div>
                  <Badge variant="danger">{alertas.incidencias.length}</Badge>
                </CardHeader>
                <CardContent className="max-h-80 overflow-y-auto p-0">
                  {alertas.incidencias.map(i => (
                    <div key={i.id} className="space-y-2 border-t border-border px-5 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p><span className="font-mono font-bold">{i.codigo_caja}</span> · {i.tipo}</p>
                          <p className="text-sm text-muted-foreground">{fecha(i.fecha)} · contadas {i.piezas_contadas} de {i.piezas_esperadas}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="warn">Faltan {i.piezas_esperadas - i.piezas_contadas}</Badge>
                          {puedeResolver && resolviendo?.id !== i.id && (
                            <Button size="sm" variant="secondary" disabled={resolviendo?.enviando} onClick={() => setResolviendo({ id: i.id, texto: '' })}>Resolver</Button>
                          )}
                        </div>
                      </div>
                      {resolviendo?.id === i.id && (
                        <div className="flex flex-wrap gap-2">
                          <Input autoFocus disabled={resolviendo.enviando} value={resolviendo.texto} onChange={(e) => setResolviendo({ ...resolviendo, texto: e.target.value })}
                            placeholder="Ej.: se repusieron 2 pinzas desde reserva" aria-label={`Resolución de ${i.codigo_caja}`} className="min-w-[220px] flex-1" />
                          <Button size="sm" disabled={resolviendo.enviando || resolviendo.texto.trim().length < 3} onClick={() => resolver(i.id)}>{resolviendo.enviando ? 'Guardando…' : 'Confirmar'}</Button>
                          <Button size="sm" variant="ghost" disabled={resolviendo.enviando} onClick={() => setResolviendo(null)}>Cancelar</Button>
                          {resolviendo.error && <p role="alert" className="w-full text-sm font-bold text-danger">{resolviendo.error}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {alertas.cargasDemoradas.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>Cargas de autoclave sin resultado</CardTitle>
                    <CardDescription>Un ciclo dura cerca de 2 horas: estas llevan más de 3 en proceso.</CardDescription>
                  </div>
                  <Badge variant="danger">{alertas.cargasDemoradas.length}</Badge>
                </CardHeader>
                <CardContent className="max-h-72 overflow-y-auto p-0">
                  {alertas.cargasDemoradas.map(c => (
                    <button key={c.id} onClick={() => navigate('/autoclave')} className="flex w-full items-center justify-between gap-3 border-t border-border px-5 py-3 text-left hover:bg-muted/40">
                      <span className="font-mono font-bold">M{c.numero_maquina}-C{c.numero_ciclo}</span>
                      <Badge variant="warn">{c.horas >= 48 ? `Hace ${Math.floor(c.horas / 24)} días` : `Hace ${c.horas} h`}</Badge>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Empaques por vencer</CardTitle>
                <Badge variant="danger">{alertas.cajasPorVencer.length}</Badge>
              </CardHeader>
              <CardContent className="max-h-72 overflow-y-auto p-0">
                {alertas.cajasPorVencer.length === 0 && <p className="px-5 pb-5 text-sm text-muted-foreground">Ninguno en los próximos 7 días.</p>}
                {alertas.cajasPorVencer.map(caja => (
                  <div key={caja.id} className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
                    <div className="min-w-0">
                      <p className="font-mono font-bold">{caja.codigo_caja}</p>
                      <p className="truncate text-sm text-muted-foreground">{caja.nombre_equipo}</p>
                    </div>
                    <Badge variant={caja.dias_restantes < 0 ? 'danger' : 'warn'}>
                      {caja.dias_restantes < 0 ? `Vencida hace ${Math.abs(caja.dias_restantes)} d` : caja.dias_restantes === 0 ? 'Vence hoy' : `Vence en ${caja.dias_restantes} d`}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Stock bajo el mínimo</CardTitle>
                <Badge variant="warn">{alertas.stockBajo.length}</Badge>
              </CardHeader>
              <CardContent className="max-h-72 overflow-y-auto p-0">
                {alertas.stockBajo.length === 0 && <p className="px-5 pb-5 text-sm text-muted-foreground">Todos los tipos de caja tienen stock suficiente.</p>}
                {alertas.stockBajo.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{item.nombre_equipo}</p>
                      <p className="font-mono text-xs text-muted-foreground">{item.codigo_barra || '—'}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono font-bold tabular-nums">{item.cantidad_disponible}<span className="text-muted-foreground"> / {item.cantidad_total ?? '—'}</span></p>
                      <p className="text-xs font-bold text-warn">{item.estado_actual || 'Bajo el mínimo'}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {/* Últimos movimientos */}
      <Card>
        <CardHeader>
          <CardTitle>Últimos movimientos</CardTitle>
          <CardDescription>Los 5 cambios de estado más recientes de cualquier caja.</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Hora</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Detalle</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead className="text-right">Historial</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.movimientos.map((mov) => (
              <TableRow key={mov.id}>
                <TableCell className="whitespace-nowrap font-mono text-muted-foreground">{mov.fecha_cambio ? fecha(mov.fecha_cambio) : '—'}</TableCell>
                <TableCell><Badge variant={varianteEstado(mov.estado_nuevo)}>{nombreEstado(mov.estado_nuevo)}</Badge></TableCell>
                <TableCell>{mov.justificacion}</TableCell>
                <TableCell className="text-muted-foreground">{mov.destino || '—'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => abrirDetalles(mov)} aria-label={`Ver historial del movimiento ${mov.id}`}>Ver</Button>
                </TableCell>
              </TableRow>
            ))}
            {data.movimientos.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan="5" className="py-8 text-center text-muted-foreground">No hay movimientos registrados aún.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} content={modalContent} />
    </div>
  );
}
