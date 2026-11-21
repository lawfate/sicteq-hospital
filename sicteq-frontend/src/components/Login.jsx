import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

const API_URL = import.meta.env.VITE_API_URL;

export default function Login({ onLogin }) {
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Motivo del último cierre de sesión (lo deja api.js o el cierre por inactividad).
  const [motivoSalida] = useState(() => sessionStorage.getItem('sicteq_motivo_salida'));

  const handleLogin = async (e) => {
    e.preventDefault();
    sessionStorage.removeItem('sicteq_motivo_salida');
    setError('');
    setIsLoading(true);

    try {
      // Llamada real al backend usando la variable de entorno
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al conectar con el servidor');
      }

      // Guardamos el token para que apiFetch lo adjunte a cada llamada, y
      // para poder mantener la sesión si se recarga la página.
      localStorage.setItem('sicteq_token', data.token);

      const user = {
        id: data.user.id,
        name: data.user.nombre,
        role: data.user.rol
      };
      localStorage.setItem('sicteq_user', JSON.stringify(user));

      // Si es exitoso, pasamos el usuario real (que viene de la BD) a App.jsx
      onLogin(user);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <p className="font-mono text-3xl font-bold tracking-[0.25em] text-primary">SICTEQ</p>
          <p className="text-muted-foreground">Trazabilidad de la Central de Esterilización<br />Hospital Dr. Franco Ravera Zunino</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5 rounded-lg border border-border bg-card p-6">
          {motivoSalida && !error && (
            <p role="status" className="rounded-md border border-warn/40 bg-warn/15 p-3 text-sm font-bold text-warn">{motivoSalida}</p>
          )}
          {error && (
            <p role="alert" className="rounded-md border border-danger/40 bg-danger/15 p-3 text-sm font-bold text-danger">{error}</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="rut">RUT</Label>
            <Input id="rut" type="text" autoComplete="username" placeholder="11111111-1" value={rut} onChange={(e) => setRut(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? <><i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Validando…</> : 'Ingresar'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground">Cada persona entra con su propia cuenta. La sesión se cierra sola tras 30 minutos sin uso.</p>
      </div>
    </div>
  );
}
