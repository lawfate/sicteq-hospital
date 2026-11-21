export const API_URL = import.meta.env.VITE_API_URL;

// Wrapper de fetch que agrega el token de sesión a toda llamada a la API, y
// desloguea automáticamente si el backend responde 401 (token ausente,
// inválido o vencido). Antes cada componente hacía fetch(`${API_URL}/...`)
// directo, sin ningún header de autenticación -- centralizar esto evita
// repetir la lógica en cada uno de los ~20 puntos de llamada.
export const apiFetch = (path, options = {}) => {
  const token = localStorage.getItem('sicteq_token');
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${API_URL}${path}`, { ...options, headers }).then(async (res) => {
    if (res.status === 401) {
      // El backend explica por qué se cerró (inactividad, sesión en otro equipo...);
      // Login.jsx lo muestra al volver.
      const data = await res.clone().json().catch(() => ({}));
      if (data.error) sessionStorage.setItem('sicteq_motivo_salida', data.error);
      localStorage.removeItem('sicteq_token');
      localStorage.removeItem('sicteq_user');
      window.location.reload();
    }
    return res;
  });
};

// Mueve una caja a una etapa. Devuelve { ok, mensaje } con el motivo real del servidor.
// extra: p. ej. { piezasContadas } al recibir. incidencia = faltaron piezas.
export async function moverCaja(codigo, etapa, motivo = '', extra = {}) {
  const r = await apiFetch('/api/trazabilidad/actualizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo, stage: etapa, reason: motivo, ...extra }),
  });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, mensaje: d.error || d.message || '', incidencia: Boolean(d.incidencia) };
}

// Ficha de la caja: tipo, piezas que trae y estante donde está (o null).
export const fichaCaja = (codigo) =>
  apiFetch(`/api/cajas/${encodeURIComponent(codigo)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
