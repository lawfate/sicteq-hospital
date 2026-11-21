// Bip al escanear: el TENS mira la caja, no la pantalla. Un tono agudo = registrado;
// dos graves = revisar. Web Audio del navegador, sin archivos ni dependencias.
let ctx;

function tono(frecuencia, inicio, duracion) {
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.frequency.value = frecuencia;
  osc.type = 'square';
  vol.gain.setValueAtTime(0.08, ctx.currentTime + inicio);
  vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + duracion);
  osc.connect(vol).connect(ctx.destination);
  osc.start(ctx.currentTime + inicio);
  osc.stop(ctx.currentTime + inicio + duracion);
}

export function bip(ok = true) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ok) tono(1320, 0, 0.12);
    else { tono(220, 0, 0.18); tono(220, 0.24, 0.18); }
  } catch {
    // Sin audio (navegador sin soporte o bloqueado): la pantalla igual muestra el resultado.
  }
}
