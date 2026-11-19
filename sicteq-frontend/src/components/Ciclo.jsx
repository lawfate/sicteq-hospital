import { useState } from 'react';
import Modal from './Modal';
import { apiFetch } from '../api';
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

const METODOS_ESTERILIZACION = ["Autoclave", "Óxido de Etileno", "Plasma de Peróxido de Hidrógeno"];

export default function Ciclo() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeBox, setActiveBox] = useState(null);
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


  const handleSearch = async () => {
    try {
      const codigo = searchText.trim().toUpperCase();
      if (!codigo) return;

      const response = await apiFetch(`/api/trazabilidad/buscar/${encodeURIComponent(codigo)}`);

      // 1. Si el backend responde con error (404, 500, etc), extraemos el mensaje real
      if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `Error del servidor: ${response.status}`);
      }

      const data = await response.json();

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

      // Dirección caja -> paciente de la trazabilidad bidireccional: qué
      // paciente(s) se le vincularon a esta caja física, si los hay.
      apiFetch(`/api/cajas/${encodeURIComponent(codigo)}/pacientes`)
        .then(r => r.ok ? r.json() : [])
        .then(p => setPacientesVinculados(Array.isArray(p) ? p : []))
        .catch(() => setPacientesVinculados([]));
    } catch (err) {
      console.error(">>> ERROR DETALLADO:", err);
      alert("Problema al buscar: " + err.message);
    }
  };

  const paramsCompletados = temperatura.trim() !== '' || presion.trim() !== '' || tiempoMinutos.trim() !== '';
  const esRetroceso = activeBox && targetStage < activeBox.stage;
  const requiereJustificarSinParametros = !esRetroceso && requiereProbarEsterilizacion(targetStage) && !paramsCompletados;

  const executeAction = async () => {
    // Evita el doble-submit: sin esto, un doble click o un re-render mientras
    // la petición está en vuelo duplica el movimiento (pasó en producción con
    // CAJA-0005, dos "Etapa 4" idénticas insertadas 365ms aparte).
    if (isSubmitting) return;

    if (esRetroceso && !rollbackReason.trim()) {
      alert("ERROR: Debe ingresar el motivo técnico del retroceso.");
      return;
    }

    if (requiereJustificarSinParametros && !rollbackReason.trim()) {
      alert("ERROR: Para pasar a esta etapa debe completar los parámetros de esterilización, o dejar un comentario que justifique por qué no los tiene.");
      return;
    }

    setIsSubmitting(true);
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
      alert("Etapa actualizada con éxito");

      handleSearch();

    } catch (err) {
      alert("No se pudo procesar la acción: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const etapaDestino = ETAPAS.find(e => e.id === targetStage);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
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
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              // PB-06: listo para la pistola apenas se abre la pantalla; al volver
              // a enfocarlo se selecciona el texto, así el siguiente escaneo lo reemplaza.
              autoFocus
              onFocus={(e) => e.target.select()}
              placeholder="CAJA-0045"
              className="h-14 font-mono text-xl uppercase tracking-widest"
            />
          </div>
          <Button size="lg" onClick={handleSearch}>Buscar caja</Button>
        </CardContent>
      </Card>

      {!activeBox && (
        <p className="text-muted-foreground">Al escanear una caja verá en qué etapa está, su historial y podrá moverla a la siguiente.</p>
      )}

      {activeBox && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Línea de tiempo */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="font-mono text-2xl">{activeBox.codigo}</CardTitle>
                <Badge variant="info" className="px-3 py-1 text-sm">{ETAPAS.find(e => e.id === activeBox.stage)?.nombre}</Badge>
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

            {/* Bitácora */}
            <Card>
              <CardHeader>
                <CardTitle>Historial de la caja</CardTitle>
                <CardDescription>Del movimiento más reciente al más antiguo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {logs.map((log, idx) => (
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
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Mover de etapa */}
            <Card>
              <CardHeader>
                <CardTitle>Mover la caja</CardTitle>
                <CardDescription>Elija la etapa a la que pasa la caja.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="etapa-destino">Pasa a</Label>
                  <Select id="etapa-destino" value={targetStage} onChange={(e) => setTargetStage(parseInt(e.target.value))}>
                    {ETAPAS.map(s => <option key={s.id} value={s.id}>{s.id}. {s.nombre}</option>)}
                  </Select>
                </div>
                {esRetroceso && <p className="rounded-md border border-warn/40 bg-warn/15 p-3 text-sm font-bold text-warn">Es un retroceso: tendrá que escribir el motivo.</p>}
                <Button size="lg" className="w-full" onClick={() => setIsModalOpen(true)}>Continuar</Button>
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
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        content={{ title: `Mover ${activeBox?.codigo || ''} a ${etapaDestino?.nombre || ''}` }}
      >
        <div className="space-y-4">
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
