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
        role: data.user.rol,
        debeCambiarClave: Boolean(data.user.debe_cambiar_clave)
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background p-4 sm:p-8">
      <div className="mx-auto flex min-h-full max-w-6xl items-center justify-center">
      <div className="grid w-full overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-soft lg:grid-cols-[1.1fr_1fr]">
        <div className="relative flex flex-col justify-between gap-6 bg-gradient-to-br from-primary/10 via-lavender/10 to-accent/15 p-6 sm:p-10">
          <div><p className="text-3xl font-bold tracking-widest text-primary">SICTEQ</p><p className="mt-2 text-sm text-muted-foreground">Hospital Dr. Franco Ravera Zunino</p></div>
          <div className="max-w-md space-y-3"><h1 className="text-3xl font-bold sm:text-4xl">Cada caja, en buenas manos.</h1><p className="leading-7 text-muted-foreground">Un espacio para acompañar el trabajo de la Central de Esterilización, desde la recepción hasta la entrega a pabellón.</p></div>
          <img src="/ilustraciones/equipo-esterilizacion.png" alt="" width="1392" height="1136" className="mx-auto hidden h-64 w-full object-contain lg:block" />
        </div>
        <div className="space-y-6 p-6 sm:p-10 lg:py-16">
        <div className="space-y-2"><p className="text-sm font-bold text-accent">Bienvenido a su espacio de trabajo</p><h2 className="text-2xl font-bold">Iniciar sesión</h2><p className="text-sm text-muted-foreground">Ingrese con su RUT y contraseña para continuar.</p></div>
        <form onSubmit={handleLogin} className="space-y-5">
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
      </div>
    </div>
  );
}
