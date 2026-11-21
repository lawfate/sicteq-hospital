// Modo claro u oscuro (oscuro por defecto). Es una preferencia de cada equipo:
// vive en el navegador, no en la cuenta. Si el navegador no deja guardar, igual funciona.
const CLAVE = 'sicteq_tema';

export function temaActual() {
  try { return localStorage.getItem(CLAVE) === 'claro' ? 'claro' : 'oscuro'; } catch { return 'oscuro'; }
}

export function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  try { localStorage.setItem(CLAVE, tema); } catch { /* sin almacenamiento: solo dura esta visita */ }
}
