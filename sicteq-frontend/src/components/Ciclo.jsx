import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Modal from './Modal';
import Estacion from './Estacion';
import { apiFetch, moverCaja, fichaCaja } from '../api';
import { bip } from '../sonido';
import { imprimirHojaVida } from '../hojaVida';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea, Label } from '@/components/ui/input';
import { ETAPAS, nombreEstado, varianteEstado } from '@/etapas';

// Deriva el número de etapa desde el texto de estado_nuevo, ej. "Etapa 3".
// area_destino_id NO sirve para esto: esa columna referencia el pabellón/área
// física de destino (tabla AREA), un concepto distinto de la etapa del ciclo.
const parseStage = (estadoNuevo) => {
  // El despacho a pabellón se registra como "Despachado": equivale a Entrega.
  if (/despachad/i.test(String(estadoNuevo || ''))) return 6;
  const match = String(estadoNuevo || '').match(/Etapa\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : 1;
};

// Orden según el requerimiento formal: recepción, lavado, preparación,
// esterilización, almacenamiento, entrega. Antes solo había 5 etapas y faltaba
// "Almacenamiento" como paso propio entre esterilizar y entregar.
//
// Los parámetros del ciclo (temperatura/presión/tiempo alcanzados) se piden
// recién al PASAR a Almacenamiento o Entrega, no al entrar a Esterilización:
// son el resultado real del ciclo, que solo se conoce cuando termina. Si no
// se completan (p. ej. porque se salta directo de un paso anterior sin pasar
// por Esterilización), hay que dejar un comentario obligatorio que lo
// justifique -- igual que un retroceso.
const requiereProbarEsterilizacion = (stage) => stage === 5 || stage === 6;

// Siguiente paso normal desde cada etapa (6 = en pabellón). Esterilización entra
// por una carga de autoclave y la salida a pabellón por un pedido: ahí se enlaza.
const SIGUIENTE = {
  1: { etapa: 2, texto: 'Pasar a Lavado' },
  2: { etapa: 3, texto: 'Pasar a Preparación' },
  3: { ruta: '/autoclave', texto: 'Armar carga de autoclave' },
  4: { etapa: 5, texto: 'Pasar a Bodega estéril' },
  5: { nota: 'Lista en bodega estéril. Sale a pabellón cuando se entrega con un pedido.' },
  6: { etapa: 1, texto: 'Recibir desde pabellón', motivo: 'Recepción desde pabellón' },
};

const METODOS_ESTERILIZACION = ["Autoclave", "Óxido de Etileno", "Plasma de Peróxido de Hidrógeno"];

export default function Ciclo({ user }) {
  const navigate = useNavigate();
  const [modo, setModo] = useState(() => ({ estacion: 'estacion', registrar: 'caja' }[new URLSearchParams(window.location.search).get('modo')] || 'revisar'));
  const consulta = useRef(0);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [errorAccion, setErrorAccion] = useState('');
  const [historialCompleto, setHistorialCompleto] = useState(false);
  const [avance, setAvance] = useState({ enviando: false, mensaje: '', ok: false });
  const [ficha, setFicha] = useState(null); // tipo, piezas y estante de la caja en pantalla
  const [contadas, setContadas] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeBox, setActiveBox] = useState(null);
  const [searchParams] = useSearchParams();
  const { key: navegacion } = useLocation(); // cambia en cada escaneo de la cabecera, aunque el código se repita
  const [logs, setLogs] = useState([]);
  const [pacientesVinculados, setPacientesVinculados] = useState([]);
  const [targetStage, setTargetStage] = useState(1);
  const [rollbackReason, setRollbackReason] = useState("");
  const [metodo, setMetodo] = useState(METODOS_ESTERILIZACION[0]);
  const [temperatura, setTemperatura] = useState("");
  const [presion, setPresion] = useState("");
  const [tiempoMinutos, setTiempoMinutos] = useState("");
  const [vigenciaDias, setVigenciaDias] = useState("365");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recibe el código explícito: del campo, de la URL (?codigo= desde la cabecera) o de la caja activa.
  const handleSearch = useCallback(async (codigoParam) => {
    const codigo = String(codigoParam || '').trim().toUpperCase();
    if (!codigo) return;
    const turno = ++consulta.current;
    setSearchText('');
    setBuscando(true);
    setErrorBusqueda('');
    setActiveBox(null);
    setFicha(null);
    setPacientesVinculados([]);
    setHistorialCompleto(false);
    try {

      const response = await apiFetch(`/api/trazabilidad/buscar/${encodeURIComponent(codigo)}`);

      // 1. Si el backend responde con error (404, 500, etc), extraemos el mensaje real
      if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `Error del servidor: ${response.status}`);
      }

      const data = await response.json();
      const [ficha, pacientes] = await Promise.all([
        fichaCaja(codigo),
        ['Enfermera', 'IT'].includes(user?.role)
          ? apiFetch(`/api/cajas/${encodeURIComponent(codigo)}/pacientes`).then((r) => r.ok ? r.json() : []).catch(() => [])
          : Promise.resolve([]),
      ]);
      if (turno !== consulta.current) return;

      // 2. Validamos que el backend realmente envió un historial y no un array vacío
      if (!data || data.length === 0) {
          throw new Error("Esta caja todavía no tiene ningún movimiento registrado.");
      }

      const ultimoRegistro = data[0];

      // 3. Validamos que el registro tenga la estructura esperada
      if (!ultimoRegistro || !ultimoRegistro.estado_nuevo) {
          console.warn("Registro devuelto por la BD está incompleto:", ultimoRegistro);
      }

      const stageActual = parseStage(ultimoRegistro?.estado_nuevo);

      setActiveBox({
          codigo,
          stage: stageActual
      });
      setTargetStage(stageActual);

      setLogs(data);
      setFicha(ficha);
      setContadas(ficha?.piezas ? String(ficha.piezas) : '');
      setPacientesVinculados(Array.isArray(pacientes) ? pacientes : []);

      // Dirección caja -> paciente de la trazabilidad bidireccional: qué
      // paciente(s) se le vincularon a esta caja física, si los hay.
    } catch (err) {
      if (turno === consulta.current) { setErrorBusqueda(`${codigo}: ${err.message}`); bip(false); }
    } finally {
      if (turno === consulta.current) setBuscando(false);
    }
  }, [user]);

  const codigoUrl = searchParams.get('codigo');
  const modoUrl = searchParams.get('modo');

  useEffect(() => {
    let vigente = true;
    queueMicrotask(() => {
      if (!vigente) return;
      if (codigoUrl) { setModo('revisar'); handleSearch(codigoUrl); }
      else if (modoUrl === 'estacion') setModo('estacion');
      else if (modoUrl === 'registrar') setModo('caja');
    });
    return () => { vigente = false; };
  }, [codigoUrl, modoUrl, navegacion, handleSearch]);

  const paramsCompletados = temperatura.trim() !== '' || presion.trim() !== '' || tiempoMinutos.trim() !== '';
  const esRetroceso = activeBox && targetStage < activeBox.stage;
  const requiereJustificarSinParametros = !esRetroceso && requiereProbarEsterilizacion(targetStage) && !paramsCompletados;

  const executeAction = async () => {
    // Evita el doble-submit: sin esto, un doble click o un re-render mientras
    // la petición está en vuelo duplica el movimiento (pasó en producción con
    // CAJA-0005, dos "Etapa 4" idénticas insertadas 365ms aparte).
    if (isSubmitting) return;

    if (esRetroceso && !rollbackReason.trim()) {
      setErrorAccion('Escriba el motivo del retroceso.');
      return;
    }

    if (requiereJustificarSinParametros && !rollbackReason.trim()) {
      setErrorAccion('Complete los datos del ciclo o explique por qué no los tiene.');
      return;
    }

    setIsSubmitting(true);
    setErrorAccion('');
    try {
      // Usamos la caja ya cargada (activeBox), no el input de busqueda en vivo:
      // si el usuario edita o borra el campo despues de buscar pero antes de
      // confirmar, searchText ya no coincide con la caja que esta en pantalla.
      const body = {
        codigo: activeBox.codigo,
        stage: targetStage,
        reason: rollbackReason
      };

      // Los parámetros del ciclo se registran al pasar a Almacenamiento o Entrega
      // (el resultado real del ciclo, no al entrar a Esterilización).
      if (requiereProbarEsterilizacion(targetStage) && paramsCompletados) {
        body.metodo = metodo;
        body.temperatura = temperatura;
        body.presion = presion;
        body.tiempoMinutos = tiempoMinutos;
      }

      // La vigencia del empaque solo aplica al entrar a Almacenamiento: es
      // el punto donde arranca a correr el reloj de caducidad.
      if (targetStage === 5) {
        body.vigenciaDias = vigenciaDias;
      }

      const response = await apiFetch(`/api/trazabilidad/actualizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error("Error al actualizar estado");

      setRollbackReason("");
      setTemperatura("");
      setPresion("");
      setTiempoMinutos("");
      setVigenciaDias("365");
      setIsModalOpen(false);
      setAvance({ codigo: activeBox.codigo, ok: true, mensaje: 'Etapa actualizada con éxito.' });
      bip(true);

      handleSearch(activeBox.codigo);

    } catch (err) {
      setErrorAccion('No se pudo registrar: ' + err.message);
      bip(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const etapaDestino = ETAPAS.find(e => e.id === targetStage);
  const siguiente = activeBox && SIGUIENTE[activeBox.stage];

  // Un clic: la caja pasa a su etapa siguiente sin formulario (para Bodega estéril
  // el servidor toma los datos de la carga liberada como Estéril).
  const avanzar = async () => {
    if (avance.enviando || !siguiente?.etapa) return;
    setAvance({ enviando: true, mensaje: '', ok: false });
    try {
      const cuenta = siguiente.etapa === 1 && ficha?.piezas ? { piezasContadas: Number(contadas) } : {};
      const r = await moverCaja(activeBox.codigo, siguiente.etapa, siguiente.motivo, cuenta);
      bip(r.ok);
      setAvance({ codigo: activeBox.codigo, enviando: false, ok: r.ok, mensaje: !r.ok ? r.mensaje || 'No se pudo mover la caja.' : r.incidencia ? `${activeBox.codigo} recibida con ${ficha.piezas - Number(contadas)} pieza(s) faltante(s): quedó una incidencia en el Panel.` : `${activeBox.codigo} quedó en ${ETAPAS.find(e => e.id === siguiente.etapa).nombre}.` });
      if (r.ok) handleSearch(activeBox.codigo);
    } catch {
      bip(false);
      setAvance({ codigo: activeBox.codigo, enviando: false, ok: false, mensaje: 'Sin conexión con el servidor.' });
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="grid gap-2 rounded-xl border border-border bg-card p-2 sm:grid-cols-3" aria-label="Forma de trabajo">
        {[['revisar', 'Consultar una caja'], ['caja', 'Registrar un avance'], ['estacion', 'Trabajar por estación']].map(([id, texto]) => (
          <button key={id} type="button" aria-pressed={modo === id} disabled={avance.enviando || isSubmitting} onClick={() => setModo(id)}
            className={`min-h-12 rounded-lg px-4 py-3 text-sm font-bold transition-colors ${modo === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
            {texto}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{modo === 'estacion' ? 'Para varias cajas: elija su estación y registre cada escaneo.' : modo === 'caja' ? 'Busque una caja y registre su siguiente paso.' : 'Busque una caja para ver su ubicación, etapa e historial.'}</p>

      {modo === 'estacion' ? <Estacion /> : (<>
      {/* Escáner: lo primero y lo más grande de la pantalla */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="buscar-caja">Escanee o escriba el código de la caja</Label>
            <Input
              id="buscar-caja"
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchText)}
              disabled={avance.enviando || isSubmitting}
              // PB-06: listo para la pistola apenas se abre la pantalla; al volver
              // a enfocarlo se selecciona el texto, así el siguiente escaneo lo reemplaza.
              autoFocus
              onFocus={(e) => e.target.select()}
              placeholder="CAJA-0045"
              className="h-14 font-mono text-xl uppercase tracking-widest"
            />
          </div>
          <Button size="lg" disabled={avance.enviando || isSubmitting || !searchText.trim()} onClick={() => handleSearch(searchText)}>Buscar caja</Button>
        </CardContent>
      </Card>
      {buscando && <p role="status" className="text-primary">Buscando caja…</p>}
      {errorBusqueda && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-4 font-bold text-danger">{errorBusqueda}</p>}

      {!activeBox && (
        <p className="text-muted-foreground">Al escanear una caja verá en qué etapa está, su historial y podrá moverla a la siguiente.</p>
      )}

      {activeBox && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

            {/* Línea de tiempo */}
            <Card className="lg:col-span-3">
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="min-w-[12rem] flex-1 space-y-1">
                  <CardTitle className="whitespace-nowrap font-mono text-2xl">{activeBox.codigo}</CardTitle>
                  {ficha && <CardDescription>{ficha.tipo}{ficha.piezas ? ` · ${ficha.piezas} piezas` : ''}</CardDescription>}
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={async () => {
                    const error = await imprimirHojaVida(activeBox.codigo);
                    if (error) setAvance({ codigo: activeBox.codigo, ok: false, mensaje: error });
                  }}>Hoja de vida</Button>
                  {ficha?.estante && <Badge variant="ok" className="px-3 py-1 font-mono text-sm">{ficha.estante}</Badge>}
                  <Badge variant="info" className="px-3 py-1 text-sm">{ETAPAS.find(e => e.id === activeBox.stage)?.nombre}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ol className="grid grid-cols-3 gap-2 2xl:grid-cols-6">
                  {ETAPAS.map((etapa) => {
                    const hecha = activeBox.stage > etapa.id;
                    const actual = activeBox.stage === etapa.id;
                    return (
                      <li key={etapa.id} className={`rounded-md border p-3 ${actual ? 'border-primary bg-primary/10' : hecha ? 'border-border bg-muted' : 'border-dashed border-border'}`}>
                        <p className={`font-mono text-xs ${actual ? 'text-primary' : 'text-muted-foreground'}`}>{etapa.id}</p>
                        <p className={`text-sm font-bold leading-tight hyphens-auto break-words ${actual ? 'text-foreground' : hecha ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>{etapa.nombre}</p>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>

          <div className="space-y-6">
            {/* Mover de etapa */}
            <Card>
              <CardHeader>
                <CardTitle>{modo === 'revisar' ? 'Ubicación y etapa actual' : 'Siguiente paso'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {modo === 'revisar' ? <><p className="font-bold text-primary">{ETAPAS.find((e) => e.id === activeBox.stage)?.nombre}</p><p className="text-muted-foreground">{ficha?.estante ? `Estante ${ficha.estante}` : 'Sin estante registrado'}</p><Button className="w-full" onClick={() => setModo('caja')}>Registrar un avance</Button></> : <>
                {siguiente?.nota && <p className="text-sm text-muted-foreground">{siguiente.nota}</p>}
                {siguiente?.etapa === 1 && ficha?.piezas && (
                  <div className="space-y-1.5">
                    <Label htmlFor="piezas-recibidas">Piezas contadas (trae {ficha.piezas})</Label>
                    <Input id="piezas-recibidas" inputMode="numeric" className="w-32 font-mono text-xl" value={contadas}
                      onChange={(e) => setContadas(e.target.value.replace(/\D/g, '').slice(0, 3))} />
                    {Number(contadas) < ficha.piezas && <p className="text-sm font-bold text-warn">Faltan {ficha.piezas - Number(contadas)}: quedará una incidencia.</p>}
                  </div>
                )}
                {siguiente && !siguiente.nota && (
                  <Button size="lg" className="w-full" disabled={avance.enviando || (siguiente.etapa === 1 && ficha?.piezas && (contadas === '' || Number(contadas) > ficha.piezas))}
                    onClick={() => (siguiente.ruta ? navigate(siguiente.ruta) : avanzar())}>
                    {avance.enviando ? 'Guardando…' : siguiente.texto}
                  </Button>
                )}
                {avance.mensaje && avance.codigo === activeBox.codigo && (
                  <p role={avance.ok ? 'status' : 'alert'} className={`rounded-md border p-3 text-sm font-bold ${avance.ok ? 'border-ok/40 bg-ok/15 text-ok' : 'border-danger/40 bg-danger/15 text-danger'}`}>{avance.mensaje}</p>
                )}
                <details className="group space-y-3 border-t border-border pt-3">
                  <summary className="cursor-pointer text-sm font-bold text-muted-foreground">Otra etapa o corrección</summary>
                <div className="space-y-1.5">
                  <Label htmlFor="etapa-destino">Pasa a</Label>
                  <Select id="etapa-destino" value={targetStage} onChange={(e) => setTargetStage(parseInt(e.target.value))}>
                    {ETAPAS.map(s => <option key={s.id} value={s.id}>{s.id}. {s.nombre}</option>)}
                  </Select>
                </div>
                {esRetroceso && <p className="rounded-md border border-warn/40 bg-warn/15 p-3 text-sm font-bold text-warn">Es un retroceso: tendrá que escribir el motivo.</p>}
                <Button variant="secondary" className="w-full" disabled={avance.enviando} onClick={() => { setErrorAccion(''); setIsModalOpen(true); }}>Continuar</Button>
                </details>
                </>}
              </CardContent>
            </Card>

            {pacientesVinculados.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Pacientes con esta caja</CardTitle>
                  <CardDescription>{pacientesVinculados.length} en total; se muestran los 3 más recientes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pacientesVinculados.slice(0, 3).map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{p.nombre}</span>
                        <span className="font-mono text-xs text-muted-foreground">{p.rut}</span>
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{new Date(p.fecha_vinculo).toLocaleDateString('es-CL')}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
            {/* Bitácora */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Historial de la caja</CardTitle>
                <CardDescription>Del movimiento más reciente al más antiguo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(historialCompleto ? logs : logs.slice(0, 5)).map((log, idx) => (
                  <div key={idx} className="grid gap-1 rounded-md border border-border bg-background p-3 sm:grid-cols-[10rem_1fr]">
                    <p className="font-mono text-sm text-muted-foreground">{log.fecha_cambio ? new Date(log.fecha_cambio).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : log.time}</p>
                    <div className="space-y-1">
                      <Badge variant={varianteEstado(log.estado_nuevo)}>{nombreEstado(log.estado_nuevo || log.event)}</Badge>
                      {log.metodo_esterilizacion && (
                        <p className="font-mono text-sm text-primary">
                          {log.metodo_esterilizacion}
                          {log.temperatura ? ` · ${log.temperatura} °C` : ''}
                          {log.presion ? ` · ${log.presion}` : ''}
                          {log.tiempo_minutos ? ` · ${log.tiempo_minutos} min` : ''}
                        </p>
                      )}
                      {log.justificacion && log.justificacion !== `Avance a ${log.estado_nuevo}` && (
                        <p className="text-sm text-muted-foreground">{log.justificacion}</p>
                      )}
                    </div>
                  </div>
                ))}
                {logs.length > 5 && <Button variant="secondary" aria-expanded={historialCompleto} onClick={() => setHistorialCompleto(!historialCompleto)}>{historialCompleto ? 'Ver solo los 5 últimos' : `Ver historial completo (${logs.length})`}</Button>}
              </CardContent>
            </Card>
        </div>
      )}

      </>)}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        content={{ title: `Mover ${activeBox?.codigo || ''} a ${etapaDestino?.nombre || ''}` }}
      >
        <div className="space-y-4">
          {errorAccion && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-danger">{errorAccion}</p>}
          {requiereProbarEsterilizacion(targetStage) && (
            <div className="space-y-3 rounded-md border border-primary/40 bg-primary/10 p-4">
              <p className="text-sm font-bold">Resultado del ciclo de esterilización</p>
              <p className="-mt-2 text-sm text-muted-foreground">Complete los datos del voucher, o explique abajo por qué no los tiene.</p>
              <div className="space-y-1.5">
                <Label htmlFor="metodo-ciclo">Método</Label>
                <Select id="metodo-ciclo" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                  {METODOS_ESTERILIZACION.map(m => <option key={m} value={m}>{m}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="temp-ciclo">°C</Label>
                  <Input id="temp-ciclo" type="number" step="0.1" className="font-mono" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} placeholder="134" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="presion-ciclo">Presión</Label>
                  <Input id="presion-ciclo" type="text" className="font-mono" value={presion} onChange={(e) => setPresion(e.target.value)} placeholder="2.1 bar" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="min-ciclo">Minutos</Label>
                  <Input id="min-ciclo" type="number" className="font-mono" value={tiempoMinutos} onChange={(e) => setTiempoMinutos(e.target.value)} placeholder="20" />
                </div>
              </div>
              {targetStage === 5 && (
                <div className="space-y-1.5 border-t border-border pt-3">
                  <Label htmlFor="vigencia">Vigencia del empaque (días)</Label>
                  <Input id="vigencia" type="number" min="1" className="w-32 font-mono" value={vigenciaDias} onChange={(e) => setVigenciaDias(e.target.value)} placeholder="365" />
                  <p className="text-xs text-muted-foreground">Desde hoy se calcula la fecha de vencimiento del empaque.</p>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="comentario">
              {esRetroceso
                ? "Motivo del retroceso (obligatorio)"
                : requiereJustificarSinParametros
                  ? "Comentario (obligatorio: faltan los datos del ciclo)"
                  : "Comentario (opcional)"}
            </Label>
            <Textarea id="comentario" value={rollbackReason} onChange={(e) => setRollbackReason(e.target.value)} placeholder="Escriba aquí…" />
          </div>
          <Button size="lg" onClick={executeAction} disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Guardando…" : "Confirmar"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
