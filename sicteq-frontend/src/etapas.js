// Nombres y colores de los estados de una caja, iguales en todas las pantallas.
// En la base se guardan como "Etapa N" o "Despachado"; al personal se le muestra la palabra de la Central.
export const ETAPAS = [
  { id: 1, nombre: 'Recepción', icono: 'fa-inbox' },
  { id: 2, nombre: 'Lavado', icono: 'fa-soap' },
  { id: 3, nombre: 'Preparación', icono: 'fa-box-open' },
  { id: 4, nombre: 'Esterilización', icono: 'fa-temperature-high' },
  { id: 5, nombre: 'Bodega estéril', icono: 'fa-warehouse' },
  { id: 6, nombre: 'Entrega', icono: 'fa-truck-medical' },
];

const numeroDe = (estado) => {
  const m = String(estado || '').match(/Etapa\s*(\d+)/i);
  return m ? Number(m[1]) : null;
};

// 'Etapa 3' -> 3; 'Despachado' -> 6 (en pabellón); sin movimientos -> null.
export const etapaDe = (estado) => (/despachad/i.test(estado || '') ? 6 : numeroDe(estado));

export function nombreEstado(estado) {
  if (!estado) return 'Sin movimientos';
  if (/despachad/i.test(estado)) return 'En pabellón';
  const n = numeroDe(estado);
  return ETAPAS.find((e) => e.id === n)?.nombre || estado;
}

// Variante de Badge: verde = lista en bodega, azul = en proceso, rojo = problema.
export function varianteEstado(estado) {
  if (!estado) return 'default';
  if (/merma|alerta|no est/i.test(estado)) return 'danger';
  if (/despachad/i.test(estado)) return 'default';
  const n = numeroDe(estado);
  if (n === 5) return 'ok';
  if (n >= 1 && n <= 4) return 'info';
  return 'default';
}
