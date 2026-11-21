import { useState } from 'react';
import { apiFetch } from '../api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

// Cambio de clave. Obligatoria (pantalla completa) cuando IT creó o reseteó la
// cuenta; voluntaria desde el menú. El servidor exige lo mismo: mínimo 8.
export default function CambiarClave({ obligatoria, onListo, onSalir }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [estado, setEstado] = useState({ enviando: false, error: '', ok: false });

  const guardar = async (e) => {
    e.preventDefault();
    if (nueva.length < 8) return setEstado({ error: 'La clave nueva debe tener al menos 8 caracteres.' });
    if (nueva !== repetida) return setEstado({ error: 'Las dos claves nuevas no coinciden.' });
    setEstado({ enviando: true, error: '' });
    try {
      const r = await apiFetch('/api/auth/cambiar-clave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual, nueva }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo cambiar la clave.');
      setActual(''); setNueva(''); setRepetida('');
      setEstado({ ok: true });
      onListo?.();
    } catch (err) {
      setEstado({ error: err.message });
    }
  };

  const formulario = (
    <form onSubmit={guardar} className="space-y-5 rounded-lg border border-border bg-card p-6">
      {obligatoria && (
        <p className="rounded-md border border-warn/40 bg-warn/15 p-3 text-sm font-bold text-warn">
          Está usando una clave temporal. Elija una propia para continuar.
        </p>
      )}
      {estado.error && <p role="alert" className="rounded-md border border-danger/40 bg-danger/15 p-3 text-sm font-bold text-danger">{estado.error}</p>}
      {estado.ok && !obligatoria && <p role="status" className="rounded-md border border-ok/40 bg-ok/15 p-3 text-sm font-bold text-ok">Clave actualizada.</p>}
      <div className="space-y-2">
        <Label htmlFor="clave-actual">{obligatoria ? 'Clave temporal' : 'Clave actual'}</Label>
        <Input id="clave-actual" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} required autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="clave-nueva">Clave nueva (mínimo 8 caracteres)</Label>
        <Input id="clave-nueva" type="password" autoComplete="new-password" minLength={8} value={nueva} onChange={(e) => setNueva(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="clave-repetida">Repita la clave nueva</Label>
        <Input id="clave-repetida" type="password" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} required />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={estado.enviando}>
        {estado.enviando ? 'Guardando…' : 'Guardar clave'}
      </Button>
      {obligatoria && <Button variant="ghost" className="w-full" onClick={onSalir}>Salir</Button>}
    </form>
  );

  if (!obligatoria) return <div className="mx-auto max-w-sm">{formulario}</div>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <p className="font-mono text-3xl font-bold tracking-[0.25em] text-primary">SICTEQ</p>
        {formulario}
      </div>
    </div>
  );
}
