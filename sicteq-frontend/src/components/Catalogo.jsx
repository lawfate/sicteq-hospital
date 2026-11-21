import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { nombreEstado } from '@/etapas';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select, Label } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function Catalogo() {
  const [tipos, setTipos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [estantes, setEstantes] = useState([]);
  const [tipoForm, setTipoForm] = useState({ codigo: '', nombre: '', categoria_id: '', piezas: '', stock: '' });
  const [tipoEditando, setTipoEditando] = useState(null);
  const [tipoAbierto, setTipoAbierto] = useState(false);
  const [cajasPorTipo, setCajasPorTipo] = useState({});
  const [tiposExpandidos, setTiposExpandidos] = useState([]);
  const [baja, setBaja] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [estanteForm, setEstanteForm] = useState({ codigo: '', descripcion: '' });
  const [estado, setEstado] = useState({ cargando: false, mensaje: '', ok: false });

  const cargar = useCallback(async () => {
    try {
      const [tiposRes, categoriasRes, estantesRes] = await Promise.all([
        apiFetch('/api/inventario'),
        apiFetch('/api/inventario/categorias'),
        apiFetch('/api/estantes'),
      ]);
      const [tiposData, categoriasData, estantesData] = await Promise.all([
        tiposRes.json().catch(() => []),
        categoriasRes.json().catch(() => []),
        estantesRes.json().catch(() => []),
      ]);
      if (!tiposRes.ok) throw new Error(tiposData.error || 'No se pudo cargar los tipos de caja.');
      if (!categoriasRes.ok) throw new Error(categoriasData.error || 'No se pudo cargar las categorías.');
      if (!estantesRes.ok) throw new Error(estantesData.error || 'No se pudo cargar los estantes.');
      setTipos(Array.isArray(tiposData) ? tiposData : []);
      setCategorias(Array.isArray(categoriasData) ? categoriasData : []);
      setEstantes(Array.isArray(estantesData) ? estantesData : []);
    } catch (error) {
      setEstado({ cargando: false, mensaje: error.message, ok: false });
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(cargar);
  }, [cargar]);

  const abrirNuevo = () => {
    setTipoEditando(null);
    setTipoForm({
      codigo: '',
      nombre: '',
      categoria_id: categorias[0] ? String(categorias[0].id) : '',
      piezas: '',
      stock: '',
    });
    setTipoAbierto(true);
  };

  const abrirEditar = (tipo) => {
    setTipoEditando(tipo.id);
    setTipoForm({
      codigo: tipo.codigo_barra || '',
      nombre: tipo.nombre_equipo || '',
      categoria_id: tipo.categoria_id ? String(tipo.categoria_id) : (categorias[0] ? String(categorias[0].id) : ''),
      piezas: String(tipo.piezas ?? ''),
      stock: String(tipo.stock_critico ?? ''),
    });
    setTipoAbierto(true);
  };

  const guardarTipo = async (e) => {
    e.preventDefault();
    setEstado({ cargando: true, mensaje: '', ok: false });
    try {
      const cuerpo = {
        codigo_barra: tipoForm.codigo.trim().toUpperCase(),
        nombre_equipo: tipoForm.nombre.trim(),
        categoria_id: Number(tipoForm.categoria_id),
        piezas: Number(tipoForm.piezas),
        stock_critico: Number(tipoForm.stock),
      };
      const r = await apiFetch(tipoEditando ? `/api/inventario/${tipoEditando}` : '/api/inventario', {
        method: tipoEditando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || (tipoEditando ? 'No se pudo editar el tipo.' : 'No se pudo crear el tipo.'));
      setTipoAbierto(false);
      setTipoEditando(null);
      setEstado({ cargando: false, mensaje: tipoEditando ? 'Tipo de caja actualizado.' : 'Tipo de caja creado.', ok: true });
      await cargar();
    } catch (error) {
      setEstado({ cargando: false, mensaje: error.message, ok: false });
    }
  };

  const cargarCajas = async (tipoId) => {
    try {
      const r = await apiFetch(`/api/cajas?inventario_id=${tipoId}`);
      const d = await r.json().catch(() => []);
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar las cajas.');
      setCajasPorTipo((actual) => ({ ...actual, [tipoId]: Array.isArray(d) ? d : [] }));
    } catch (error) {
      setEstado({ cargando: false, mensaje: error.message, ok: false });
    }
  };

  const alternarCajas = (tipoId) => {
    if (tiposExpandidos.includes(tipoId)) {
      setTiposExpandidos((actual) => actual.filter((id) => id !== tipoId));
      return;
    }
    setTiposExpandidos((actual) => [...actual, tipoId]);
    cargarCajas(tipoId);
  };

  const agregarCaja = async (tipoId) => {
    setEstado({ cargando: true, mensaje: '', ok: false });
    try {
      const r = await apiFetch('/api/cajas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventario_id: tipoId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo agregar la caja.');
      setEstado({
        cargando: false,
        mensaje: `Se creó ${d.codigo_caja}: imprima su etiqueta en Etiquetas`,
        ok: true,
      });
      await cargarCajas(tipoId);
      await cargar();
    } catch (error) {
      setEstado({ cargando: false, mensaje: error.message, ok: false });
    }
  };

  const darDeBaja = async (codigo) => {
    setEstado({ cargando: true, mensaje: '', ok: false });
    try {
      const r = await apiFetch(`/api/cajas/${encodeURIComponent(codigo)}/baja`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo dar de baja la caja.');
      setBaja(null);
      setMotivo('');
      setEstado({ cargando: false, mensaje: `${codigo} quedó de baja.`, ok: true });
      await Promise.all(tiposExpandidos.map((tipoId) => cargarCajas(tipoId)));
      await cargar();
    } catch (error) {
      setEstado({ cargando: false, mensaje: error.message, ok: false });
    }
  };

  const agregarEstante = async (e) => {
    e.preventDefault();
    setEstado({ cargando: true, mensaje: '', ok: false });
    try {
      const r = await apiFetch('/api/estantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: estanteForm.codigo.trim().toUpperCase(),
          descripcion: estanteForm.descripcion.trim(),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo agregar el estante.');
      setEstanteForm({ codigo: '', descripcion: '' });
      setEstado({ cargando: false, mensaje: 'Estante agregado.', ok: true });
      await cargar();
    } catch (error) {
      setEstado({ cargando: false, mensaje: error.message, ok: false });
    }
  };

  const aviso = estado.mensaje && (
    <p role={estado.ok ? 'status' : 'alert'} className={cn('rounded-md border p-3 text-sm font-bold', estado.ok ? 'border-ok/40 bg-ok/15 text-ok' : 'border-danger/40 bg-danger/15 text-danger')}>
      {estado.mensaje}
    </p>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {aviso}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Tipos de caja</CardTitle>
            <CardDescription>Modelos de instrumental disponibles en la Central.</CardDescription>
          </div>
          {!tipoAbierto && <Button size="sm" onClick={abrirNuevo}>Nuevo tipo</Button>}
        </CardHeader>

        {tipoAbierto && (
          <CardContent>
            <Card className="mb-4 border-primary/40">
              <CardHeader>
                <CardTitle>{tipoEditando ? 'Editar tipo' : 'Nuevo tipo'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={guardarTipo} className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="tipo-codigo">Código tipo</Label>
                    <Input id="tipo-codigo" value={tipoForm.codigo} onChange={(e) => setTipoForm({ ...tipoForm, codigo: e.target.value.toUpperCase() })} placeholder="GEN-001" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tipo-nombre">Nombre</Label>
                    <Input id="tipo-nombre" value={tipoForm.nombre} onChange={(e) => setTipoForm({ ...tipoForm, nombre: e.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tipo-categoria">Categoría</Label>
                    <Select id="tipo-categoria" value={tipoForm.categoria_id} onChange={(e) => setTipoForm({ ...tipoForm, categoria_id: e.target.value })} required>
                      {categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="tipo-piezas">Piezas por caja</Label>
                      <Input id="tipo-piezas" type="number" min="0" value={tipoForm.piezas} onChange={(e) => setTipoForm({ ...tipoForm, piezas: e.target.value })} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tipo-stock">Stock mínimo</Label>
                      <Input id="tipo-stock" type="number" min="0" value={tipoForm.stock} onChange={(e) => setTipoForm({ ...tipoForm, stock: e.target.value })} required />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <Button type="submit" disabled={estado.cargando}>{estado.cargando ? 'Guardando…' : (tipoEditando ? 'Guardar cambios' : 'Crear tipo')}</Button>
                    <Button type="button" variant="secondary" onClick={() => { setTipoAbierto(false); setTipoEditando(null); }}>Cancelar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </CardContent>
        )}

        <CardContent className="p-0">
          {tipos.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">No hay tipos de caja registrados.</p>
          ) : tipos.map((tipo) => (
            <div key={tipo.id} className="border-t border-border px-5 py-4 first:border-t-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold">{tipo.codigo_barra}</p>
                  <p className="font-bold">{tipo.nombre_equipo}</p>
                  <p className="text-sm text-muted-foreground">{tipo.piezas} piezas · {tipo.cajas ?? tipo.cantidad_total ?? 0} cajas</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => abrirEditar(tipo)}>Editar</Button>
                  <Button variant="secondary" size="sm" onClick={() => alternarCajas(tipo.id)}>
                    {tiposExpandidos.includes(tipo.id) ? 'Ocultar cajas' : 'Ver cajas'}
                  </Button>
                </div>
              </div>

              {tiposExpandidos.includes(tipo.id) && (
                <div className="mt-4 border-t border-border pt-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold">Cajas físicas</p>
                    <Button variant="outline" size="sm" disabled={estado.cargando} onClick={() => agregarCaja(tipo.id)}>Agregar caja</Button>
                  </div>
                  {(cajasPorTipo[tipo.id] || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay cajas físicas.</p>
                  ) : (
                    <div>
                      {(cajasPorTipo[tipo.id] || []).map((caja) => (
                        <div key={caja.codigo_caja} className="border-t border-border py-3 first:border-t-0">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-mono text-sm font-bold">{caja.codigo_caja}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge variant="info">{nombreEstado(caja.estado_nuevo)}</Badge>
                                {caja.estante && <span className="text-sm text-muted-foreground">{caja.estante}</span>}
                                {caja.estado === 'De baja' && <Badge variant="danger">De baja</Badge>}
                              </div>
                            </div>
                            {caja.estado !== 'De baja' && (
                              baja === caja.codigo_caja ? (
                                <div className="w-full space-y-2 sm:w-72">
                                  <Label htmlFor={`motivo-${caja.codigo_caja}`}>Motivo</Label>
                                  <Input id={`motivo-${caja.codigo_caja}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="destructive" disabled={!motivo.trim() || estado.cargando} onClick={() => darDeBaja(caja.codigo_caja)}>Confirmar</Button>
                                    <Button size="sm" variant="ghost" onClick={() => { setBaja(null); setMotivo(''); }}>Cancelar</Button>
                                  </div>
                                </div>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => { setBaja(caja.codigo_caja); setMotivo(''); }}>Dar de baja</Button>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estantes de bodega</CardTitle>
          <CardDescription>Ubicaciones físicas para guardar cajas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={agregarEstante} className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="estante-codigo">Código</Label>
              <Input id="estante-codigo" value={estanteForm.codigo} onChange={(e) => setEstanteForm({ ...estanteForm, codigo: e.target.value.toUpperCase() })} placeholder="EST-B2" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estante-descripcion">Descripción (opcional)</Label>
              <Input id="estante-descripcion" value={estanteForm.descripcion} onChange={(e) => setEstanteForm({ ...estanteForm, descripcion: e.target.value })} />
            </div>
            <Button type="submit" disabled={estado.cargando}>{estado.cargando ? 'Agregando…' : 'Agregar estante'}</Button>
          </form>

          {estantes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay estantes registrados.</p>
          ) : (
            <div className="border-t border-border">
              {estantes.map((estante) => (
                <div key={estante.codigo} className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-sm font-bold">{estante.codigo}</p>
                    {estante.descripcion && <p className="text-sm text-muted-foreground">{estante.descripcion}</p>}
                  </div>
                  <p className="text-sm text-muted-foreground">{estante.cajas ?? 0} cajas</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
