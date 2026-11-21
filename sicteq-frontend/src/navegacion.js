// Menú ordenado como el trabajo real de la Central: la caja entra, se procesa,
// pasa por el autoclave y sale a pabellón. Bodega y gestión van aparte.
// Una sola fuente para el menú (Sidebar) y el título de cada pantalla (Header).
export const SECCIONES = [
  {
    titulo: 'Operación diaria',
    items: [
      { ruta: '/', nombre: 'Panel de la Central', icono: 'fa-table-columns', ayuda: 'Qué requiere atención hoy' },
      { ruta: '/ciclo', nombre: 'Seguimiento de cajas', icono: 'fa-barcode', ayuda: 'Recepción, lavado, preparación y bodega' },
      { ruta: '/autoclave', nombre: 'Cargas de autoclave', icono: 'fa-temperature-high', ayuda: 'Registrar y liberar cargas' },
      { ruta: '/solicitudes', nombre: 'Pedidos de pabellón', icono: 'fa-clipboard-list', ayuda: 'Pedir cajas para cirugías' },
      { ruta: '/vinculo', nombre: 'Entrega y paciente', icono: 'fa-hand-holding-medical', ayuda: 'Despachar y vincular con paciente' },
    ],
  },
  {
    titulo: 'Bodega',
    items: [
      { ruta: '/inventario', nombre: 'Inventario', icono: 'fa-boxes-stacked', ayuda: 'Stock por tipo de caja' },
      { ruta: '/etiquetas', nombre: 'Etiquetas', icono: 'fa-tags', ayuda: 'Imprimir códigos de barras' },
    ],
  },
  {
    titulo: 'Gestión',
    items: [
      { ruta: '/indicadores', nombre: 'Indicadores', icono: 'fa-gauge-high', ayuda: 'Metas del proyecto' },
      { ruta: '/reportes', nombre: 'Reportes', icono: 'fa-file-lines', ayuda: 'Exportar a Excel (CSV)' },
      { ruta: '/auditoria', nombre: 'Auditoría', icono: 'fa-user-shield', ayuda: 'Quién hizo qué y cuándo', soloRol: 'IT' },
    ],
  },
];

export const pantallaDe = (ruta) => SECCIONES.flatMap((s) => s.items).find((i) => i.ruta === ruta);
