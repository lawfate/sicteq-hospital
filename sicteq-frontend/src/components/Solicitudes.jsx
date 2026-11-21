import { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, Textarea, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TIPOS = ['Programada', 'Urgencia Médica'];

const obtenerPedidos = async () => {
  const response = await apiFetch(`/api/solicitudes?mios=1&limite=20`);
  if (!response.ok) throw new Error('No se pudo cargar los pedidos.');
  return response.json();
};

// Importante: Recibimos el 'user' como prop (la enfermera conectada)
export default function Solicitudes({ user }) {
  const [areas, setAreas] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [formData, setFormData] = useState({
    cirugia: 'Programada',
    area_id: '',
    inventario_id: '',
    obs: ''
  });
  const [status, setStatus] = useState({ loading: false, message: '', type: '' });

  // Pabellones y áreas de destino, desde el backend.
  useEffect(() => {
    apiFetch(`/api/solicitudes/areas`)
      .then(res => res.json())
      .then(data => {
        setAreas(data);
        if (data.length > 0) setFormData(prev => ({ ...prev, area_id: data[0].id }));
      })
      .catch(err => console.error("Error al cargar áreas:", err));

    apiFetch(`/api/inventario`)
      .then(res => res.json())
      .then(data => {
        setInventario(data);
        if (data.length > 0) setFormData(prev => ({ ...prev, inventario_id: data[0].id }));
      })
      .catch(err => console.error("Error al cargar inventario:", err));

    obtenerPedidos()
      .then(setPedidos)
      .catch(err => console.error('Error al cargar pedidos:', err));
  }, []);

  const formatoFecha = (fecha) => {
    if (!fecha) return '—';
    const fechaObj = new Date(fecha);
    if (Number.isNaN(fechaObj.getTime())) return '—';
    const dia = String(fechaObj.getDate()).padStart(2, '0');
    const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
    const hora = String(fechaObj.getHours()).padStart(2, '0');
    const minuto = String(fechaObj.getMinutes()).padStart(2, '0');
    return `${dia}/${mes} ${hora}:${minuto}`;
  };

  const varianteEstado = (estado) => {
    if (estado === 'Despachado') return 'ok';
    if (estado === 'Listo' || estado === 'En Preparación') return 'info';
    if (estado === 'Pendiente') return 'warn';
    return 'default';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, message: '', type: '' });

    try {
      const response = await apiFetch(`/api/solicitudes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_id: formData.area_id,
          tipo_cirugia: formData.cirugia,
          inventario_id: formData.inventario_id,
          observaciones: formData.obs
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo enviar el pedido. Intente de nuevo.');
      }

      setStatus({ loading: false, message: 'Pedido enviado a la Central.', type: 'success' });
      setFormData({ ...formData, obs: '' });
      obtenerPedidos()
        .then(setPedidos)
        .catch(err => console.error('Error al cargar pedidos:', err));
      setTimeout(() => setStatus({ loading: false, message: '', type: '' }), 4000);
    } catch (error) {
      setStatus({ loading: false, message: error.message, type: 'error' });
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo pedido de cajas para pabellón</CardTitle>
          <CardDescription>El pedido queda a nombre de <span className="font-bold text-foreground">{user?.name}</span> y aparece al instante en el Panel de la Central.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <fieldset className="space-y-1.5">
              <legend className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo de cirugía</legend>
              <div className="grid grid-cols-2 gap-3" role="radiogroup">
                {TIPOS.map(t => {
                  const activo = formData.cirugia === t;
                  const urgencia = t !== 'Programada';
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() => setFormData({ ...formData, cirugia: t })}
                      className={cn(
                        'h-14 rounded-md border text-base font-bold transition-colors',
                        activo
                          ? (urgencia ? 'border-danger bg-danger/15 text-danger' : 'border-primary bg-primary/15 text-primary')
                          : 'border-border bg-background text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {urgencia ? 'Urgencia' : 'Programada'}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="pabellon">Pabellón de destino</Label>
              <Select id="pabellon" value={formData.area_id} onChange={(e) => setFormData({ ...formData, area_id: e.target.value })}>
                {areas.map(area => <option key={area.id} value={area.id}>{area.nombre}</option>)}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="instrumental">Caja que necesita</Label>
              <Select id="instrumental" value={formData.inventario_id} onChange={(e) => setFormData({ ...formData, inventario_id: e.target.value })}>
                {inventario.map(item => (
                  <option key={item.id} value={item.id}>{item.nombre_equipo}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs">Observaciones (opcional)</Label>
              <Textarea id="obs" value={formData.obs} onChange={(e) => setFormData({ ...formData, obs: e.target.value })} placeholder="Ej.: agregar pinzas de disección largas" />
            </div>

            {status.message && (
              <p role={status.type === 'success' ? 'status' : 'alert'} className={cn('rounded-md border p-3 text-sm font-bold', status.type === 'success' ? 'border-ok/40 bg-ok/15 text-ok' : 'border-danger/40 bg-danger/15 text-danger')}>
                {status.message}
              </p>
            )}

            <Button type="submit" size="lg" disabled={status.loading || !formData.inventario_id} className="w-full">
              {status.loading ? 'Enviando…' : 'Enviar pedido a la Central'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mis pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          {pedidos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no ha hecho pedidos.</p>
          ) : (
            <div>
              {pedidos.map(pedido => (
                <div key={pedido.id} className="border-b border-border py-3 last:border-b-0 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-foreground">REQ-{pedido.id}</p>
                      <p className="mt-1 text-sm text-foreground">{pedido.caja_pedida || '—'}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {pedido.area_nombre} · {formatoFecha(pedido.fecha_creacion)}
                      </p>
                    </div>
                    <Badge variant={varianteEstado(pedido.estado)}>
                      {pedido.estado === 'Despachado' ? 'Entregado' : pedido.estado}
                      {pedido.estado === 'Despachado' && pedido.caja_despachada && (
                        <span className="font-mono"> · {pedido.caja_despachada}</span>
                      )}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
