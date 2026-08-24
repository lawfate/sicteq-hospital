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

  return fetch(`${API_URL}${path}`, { ...options, headers }).then((res) => {
    if (res.status === 401) {
      localStorage.removeItem('sicteq_token');
      localStorage.removeItem('sicteq_user');
      window.location.reload();
    }
    return res;
  });
};
