import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select, Label } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({ rut: '', nombre: '', rol_id: '' });
  const [estado, setEstado] = useState({ cargando: false, mensaje: '', ok: false });
  const [confirmar, setConfirmar] = useState(null);
  const [accion, setAccion] = useState(null);
  const [claveTemporal, setClaveTemporal] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [usuariosRes, rolesRes] = await Promise.all([
        apiFetch('/api/usuarios'),
        apiFetch('/api/usuarios/roles'),
      ]);
      const usuariosData = await usuariosRes.json().catch(() => []);
      const rolesData = await rolesRes.json().catch(() => []);
      if (!usuariosRes.ok) throw new Error(usuariosData.error || 'No se pudo cargar las cuentas.');
      if (!rolesRes.ok) throw new Error(rolesData.error || 'No se pudo cargar los roles.');
      setUsuarios(Array.isArray(usuariosData) ? usuariosData : []);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setForm((actual) => ({
        ...actual,
        rol_id: actual.rol_id || (Array.isArray(rolesData) && rolesData[0] ? String(rolesData[0].id) : ''),
      }));
    } catch (error) {
      setEstado({ cargando: false, mensaje: error.message, ok: false });
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(cargar);
  }, [cargar]);

  const crear = async (e) => {
    e.preventDefault();
    setEstado({ cargando: true, mensaje: '', ok: false });
    try {
      const r = await apiFetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rut: form.rut.trim(),
          nombre: form.nombre.trim(),
          rol_id: Number(form.rol_id),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo crear la cuenta.');
      setClaveTemporal({ nombre: d.nombre || form.nombre.trim(), clave: d.clave_temporal });
      setForm({ rut: '', nombre: '', rol_id: String(roles[0]?.id || '') });
      setEstado({ cargando: false, mensaje: '', ok: true });
      await cargar();
    } catch (error) {
      setEstado({ cargando: false, mensaje: error.message, ok: false });
    }
  };

  const cambiarActivo = async (usuario, activo) => {
    setAccion(usuario.id);
    setEstado({ cargando: false, mensaje: '', ok: false });
    try {
      const r = await apiFetch(`/api/usuarios/${usuario.id}/activo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo cambiar el estado de la cuenta.');
      setConfirmar(null);
      setEstado({ cargando: false, mensaje: activo ? 'Cuenta activada.' : 'Cuenta desactivada.', ok: true });
      await cargar();
    } catch (error) {
      setEstado({ cargando: false, mensaje: error.message, ok: false });
    } finally {
      setAccion(null);
    }
  };

  const resetear = async (usuario) => {
    setAccion(usuario.id);
    setEstado({ cargando: false, mensaje: '', ok: false });
    try {
      const r = await apiFetch(`/api/usuarios/${usuario.id}/resetear`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo resetear la clave.');
      setClaveTemporal({ nombre: usuario.nombre, clave: d.clave_temporal });
      await cargar();
    } catch (error) {
      setEstado({ cargando: false, mensaje: error.message, ok: false });
    } finally {
      setAccion(null);
    }
  };

  const aviso = estado.mensaje && (
    <p role={estado.ok ? 'status' : 'alert'} className={cn('rounded-md border p-3 text-sm font-bold', estado.ok ? 'border-ok/40 bg-ok/15 text-ok' : 'border-danger/40 bg-danger/15 text-danger')}>
      {estado.mensaje}
    </p>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {aviso}

      {claveTemporal && (
        <Card className="border-primary">
          <CardContent className="space-y-3 pt-5">
            <p className="text-sm font-bold">Clave temporal de {claveTemporal.nombre}</p>
            <p className="text-3xl font-bold font-mono text-primary">{claveTemporal.clave}</p>
            <p className="text-sm text-muted-foreground">Entréguela a la persona. Al entrar deberá cambiarla. No se volverá a mostrar.</p>
            <Button variant="secondary" size="sm" onClick={() => setClaveTemporal(null)}>Listo</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Nueva cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="usuario-rut">RUT</Label>
              <Input id="usuario-rut" value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} placeholder="12.345.678-9" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usuario-nombre">Nombre</Label>
              <Input id="usuario-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usuario-rol">Rol</Label>
              <Select id="usuario-rol" value={form.rol_id} onChange={(e) => setForm({ ...form, rol_id: e.target.value })} required>
                {roles.map((rol) => <option key={rol.id} value={rol.id}>{rol.nombre}</option>)}
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={estado.cargando || !roles.length}>
                {estado.cargando ? 'Creando…' : 'Crear cuenta'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cuentas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {usuarios.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">No hay cuentas registradas.</p>
          ) : usuarios.map((usuario) => (
            <div key={usuario.id} className="border-t border-border px-5 py-4 first:border-t-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-bold">{usuario.nombre}</p>
                  <p className="font-mono text-sm text-muted-foreground">{usuario.rut}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{usuario.rol}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant={usuario.activo ? 'ok' : 'default'}>{usuario.activo ? 'Activa' : 'Desactivada'}</Badge>
                    {usuario.debe_cambiar_clave && <Badge variant="warn">Debe cambiar clave</Badge>}
                    {usuario.bloqueado && <Badge variant="danger">Bloqueada</Badge>}
                  </div>
                </div>

                {confirmar === usuario.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-danger">¿Desactivar cuenta?</span>
                    <Button size="sm" variant="destructive" disabled={accion === usuario.id} onClick={() => cambiarActivo(usuario, false)}>Confirmar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmar(null)}>Cancelar</Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" disabled={accion === usuario.id} onClick={() => resetear(usuario)}>Resetear clave</Button>
                    {usuario.activo ? (
                      <Button variant="outline" size="sm" onClick={() => setConfirmar(usuario.id)}>Desactivar</Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled={accion === usuario.id} onClick={() => cambiarActivo(usuario, true)}>Activar</Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
