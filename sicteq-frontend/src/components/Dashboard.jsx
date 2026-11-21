import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import { apiFetch } from '../api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { nombreEstado, varianteEstado } from '@/etapas';

// Las solicitudes guardan "[Instrumental Requerido: Set X] - nota": se muestra solo el set.
const cajaPedida = (texto) => String(texto || '').match(/\[Instrumental Requerido:\s*([^\]]+)\]/)?.[1] || texto || '—';

// Lo que cada rol hace a diario, a un clic desde el Panel.
const ACCIONES = {
  TENS: [
    { ruta: '/ciclo', texto: 'Recibir o mover una caja', icono: 'fa-barcode' },
    { ruta: '/autoclave', texto: 'Armar carga de autoclave', icono: 'fa-temperature-high' },
    { ancla: 'pedidos', texto: 'Entregar pedidos de pabellón', icono: 'fa-truck-medical' },
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

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', items: [] });
  const [data, setData] = useState({
    stats: { en_proceso: 0, total_equipos: 0, alertas_stock: 0, solicitudes_pendientes: 0 },
    movimientos: [],
    criticas: []
  });
  const [cajasCirculacion, setCajasCirculacion] = useState([]);
  const [showCajasCirculacion, setShowCajasCirculacion] = useState(false);
  // null = todavía cargando (antes mostraba "Sin alertas" mientras llegaba la respuesta).
  const [alertas, setAlertas] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    apiFetch(`/api/dashboard`)
      .then(res => res.json())
      .then(json => setData(json))
      .catch(err => console.error("Error cargando dashboard:", err))
      .finally(() => setCargando(false));

    apiFetch(`/api/cajas/circulacion`)
      .then(res => res.json())
      .then(json => setCajasCirculacion(Array.isArray(json) ? json : []))
      .catch(err => console.error("Error cargando cajas en circulación:", err));

    apiFetch(`/api/alertas`)
      .then(res => res.json())
      .then(json => setAlertas({
        stockBajo: Array.isArray(json.stockBajo) ? json.stockBajo : [],
        cajasPorVencer: Array.isArray(json.cajasPorVencer) ? json.cajasPorVencer : []
      }))
      .catch(err => console.error("Error cargando alertas:", err));
  }, []);

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
      const historial = await response.json();
      setModalContent({ title: `Historial: ${mov.justificacion}`, items: historial });
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error al cargar historial:", error);
    }
  };

  const resumen = [
    { titulo: 'En proceso', valor: data.stats.en_proceso, nota: 'Recepción a esterilización' },
    { titulo: 'Listas o en pabellón', valor: data.stats.total_equipos, nota: 'En bodega estéril o entregadas' },
    { titulo: 'Pedidos pendientes', valor: data.stats.solicitudes_pendientes, nota: 'Por preparar para pabellón', alerta: data.stats.solicitudes_pendientes > 0 },
    { titulo: 'Stock en alerta', valor: data.stats.alertas_stock, nota: 'Tipos de caja bajo el mínimo', alerta: data.stats.alertas_stock > 0 },
  ];
  const hayAlertas = alertas && (alertas.stockBajo.length > 0 || alertas.cajasPorVencer.length > 0);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {ACCIONES[user?.role] && (
        <section aria-label="Acciones rápidas" className="flex flex-wrap gap-3">
          {ACCIONES[user.role].map((a) => (
            <Button
              key={a.texto}
              variant="secondary"
              onClick={() => (a.ruta ? navigate(a.ruta) : document.getElementById(a.ancla)?.scrollIntoView({ behavior: 'smooth' }))}
            >
              <i className={`fa-solid ${a.icono}`} aria-hidden="true"></i>{a.texto}
            </Button>
          ))}
        </section>
      )}

      {/* Resumen: cuatro números, sin adornos, legibles a distancia */}
      <section aria-label="Resumen" className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-4">
        {resumen.map((r, i) => (
          <div key={r.titulo} className={`space-y-1 p-5 ${i > 0 ? 'border-l border-border' : ''} ${i === 2 ? 'max-lg:border-l-0 max-lg:border-t' : ''} ${i === 3 ? 'max-lg:border-t' : ''}`}>
            <p className="text-sm font-bold text-muted-foreground">{r.titulo}</p>
            <p className={`font-mono text-4xl font-bold tabular-nums ${r.alerta ? 'text-warn' : ''}`}>{cargando ? '–' : (r.valor || 0)}</p>
            <p className="text-xs text-muted-foreground">{r.nota}</p>
          </div>
        ))}
      </section>

      {/* Lo que requiere atención */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Requiere atención</h2>
        {alertas === null ? (
          <p className="text-sm text-muted-foreground"><i className="fa-solid fa-circle-notch fa-spin mr-2" aria-hidden="true"></i>Revisando stock y vencimientos…</p>
        ) : !hayAlertas ? (
          <p className="rounded-lg border border-ok/40 bg-ok/10 px-5 py-4 font-bold text-ok">Todo en orden: no hay stock bajo ni empaques por vencer.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
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

      {/* Pedidos de pabellón por atender */}
      <Card id="pedidos" className="scroll-mt-4">
        <CardHeader>
          <CardTitle>Pedidos de pabellón por atender</CardTitle>
          <CardDescription>Los 5 más recientes. Entregar abre la pantalla de entrega con el pedido cargado.</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Pedido</TableHead>
              <TableHead>Pabellón</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Caja pedida</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.criticas.map((c) => (
              <TableRow key={c.solicitud_id}>
                <TableCell className="whitespace-nowrap font-mono font-bold">REQ-{c.solicitud_id}</TableCell>
                <TableCell className="font-bold">{c.pabellon}</TableCell>
                <TableCell>
                  <Badge variant={/urgencia/i.test(c.tipo_cirugia || '') ? 'danger' : 'default'}>{c.tipo_cirugia}</Badge>
                </TableCell>
                <TableCell className="max-w-xs">{cajaPedida(c.caja_requerida)}</TableCell>
                <TableCell><Badge variant="info">{c.estado_actual}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => navigate(`/vinculo?solicitud=${c.solicitud_id}`)}>Entregar</Button>
                </TableCell>
              </TableRow>
            ))}
            {data.criticas.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan="6" className="py-8 text-center text-muted-foreground">No hay pedidos pendientes.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

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

      {/* Cajas en circulación (colapsable) */}
      <Card>
        <button
          onClick={() => setShowCajasCirculacion(prev => !prev)}
          aria-expanded={showCajasCirculacion}
          className="flex w-full items-center justify-between gap-4 rounded-lg p-5 text-left hover:bg-muted/40"
        >
          <div>
            <p className="text-lg font-bold">Todas las cajas en circulación <span className="font-mono text-muted-foreground">({cajasCirculacion.length})</span></p>
            <p className="text-sm text-muted-foreground">Dónde está cada caja y cuándo se movió por última vez.</p>
          </div>
          <i className={`fa-solid fa-chevron-down text-muted-foreground transition-transform ${showCajasCirculacion ? 'rotate-180' : ''}`} aria-hidden="true"></i>
        </button>
        {showCajasCirculacion && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Caja</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Último movimiento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cajasCirculacion.map((caja) => (
                <TableRow key={caja.id}>
                  <TableCell className="font-mono font-bold">{caja.codigo_caja}</TableCell>
                  <TableCell>{caja.nombre_equipo}</TableCell>
                  <TableCell><Badge variant={varianteEstado(caja.estado_nuevo)}>{nombreEstado(caja.estado_nuevo)}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{caja.destino_nombre || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-muted-foreground">{caja.ultima_actualizacion ? fecha(caja.ultima_actualizacion) : '—'}</TableCell>
                </TableRow>
              ))}
              {cajasCirculacion.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan="5" className="py-8 text-center text-muted-foreground">No hay cajas registradas en circulación.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} content={modalContent} />
    </div>
  );
}
