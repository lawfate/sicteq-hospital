// La nueva apariencia se estrena en claro una vez; luego conserva la elección.
// Vive en el navegador, no en la cuenta. Sin almacenamiento, igual funciona.
const CLAVE = 'sicteq_tema';
const VERSION = 'sicteq_tema_diseno_claro';

export function temaActual() {
  try { return localStorage.getItem(VERSION) === '1' && localStorage.getItem(CLAVE) === 'oscuro' ? 'oscuro' : 'claro'; } catch { return 'claro'; }
}

export function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  try { localStorage.setItem(CLAVE, tema); localStorage.setItem(VERSION, '1'); } catch { /* sin almacenamiento: solo dura esta visita */ }
}
