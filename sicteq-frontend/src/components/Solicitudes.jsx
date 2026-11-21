import { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, Textarea, Label } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const TIPOS = ['Programada', 'Urgencia Médica'];

// Importante: Recibimos el 'user' como prop (la enfermera conectada)
export default function Solicitudes({ user }) {
  const [areas, setAreas] = useState([]);
  const [formData, setFormData] = useState({
    cirugia: 'Programada',
    area_id: '',
    instrumental: 'Set Estándar de Cesárea',
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
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, message: '', type: '' });

    try {
      const response = await apiFetch(`/api/solicitudes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: user.id,
          area_id: formData.area_id,
          tipo_cirugia: formData.cirugia,
          instrumental: formData.instrumental,
          observaciones: formData.obs
        })
      });

      if (!response.ok) throw new Error('No se pudo enviar el pedido. Intente de nuevo.');

      setStatus({ loading: false, message: 'Pedido enviado a la Central.', type: 'success' });
      setFormData({ ...formData, obs: '' });
      setTimeout(() => setStatus({ loading: false, message: '', type: '' }), 4000);
    } catch (error) {
      setStatus({ loading: false, message: error.message, type: 'error' });
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
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
              <Select id="instrumental" value={formData.instrumental} onChange={(e) => setFormData({ ...formData, instrumental: e.target.value })}>
                <option>Set Estándar de Cesárea</option>
                <option>Set Colecistectomía Laparoscópica</option>
                <option>Caja de Instrumental Mayor Cirugía General</option>
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

            <Button type="submit" size="lg" disabled={status.loading} className="w-full">
              {status.loading ? <><i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Enviando…</> : 'Enviar pedido a la Central'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
