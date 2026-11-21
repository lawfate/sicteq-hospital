// Menú ordenado como el trabajo real de la Central: la caja entra, se procesa,
// pasa por el autoclave y sale a pabellón. Bodega y gestión van aparte.
// Una sola fuente para el menú (Sidebar), el título de cada pantalla (Header) y
// quién la ve (roles): lo que un rol no puede usar no se le muestra.
export const SECCIONES = [
  {
    titulo: 'Operación diaria',
    items: [
      { ruta: '/', nombre: 'Panel de la Central', icono: 'fa-table-columns', ayuda: 'Qué requiere atención hoy' },
      { ruta: '/ciclo', nombre: 'Seguimiento de cajas', icono: 'fa-barcode', ayuda: 'Recepción, lavado, preparación y bodega' },
      { ruta: '/autoclave', nombre: 'Cargas de autoclave', icono: 'fa-temperature-high', ayuda: 'Registrar y liberar cargas' },
      { ruta: '/solicitudes', nombre: 'Pedidos de pabellón', icono: 'fa-clipboard-list', ayuda: 'Pedir cajas para cirugías', roles: ['Enfermera', 'IT'] },
      { ruta: '/entrega', nombre: 'Entrega a pabellón', icono: 'fa-truck-medical', ayuda: 'Pedidos por entregar, urgencias primero', roles: ['TENS', 'IT'] },
      { ruta: '/vinculo', nombre: 'Vínculo con paciente', icono: 'fa-hand-holding-medical', ayuda: 'Qué caja se usó con qué paciente', roles: ['Enfermera', 'IT'] },
    ],
  },
  {
    titulo: 'Bodega',
    items: [
      { ruta: '/inventario', nombre: 'Inventario', icono: 'fa-boxes-stacked', ayuda: 'Stock por tipo de caja' },
      { ruta: '/etiquetas', nombre: 'Etiquetas', icono: 'fa-tags', ayuda: 'Imprimir códigos de barras de cajas y estantes' },
      { ruta: '/catalogo', nombre: 'Catálogo de cajas', icono: 'fa-box-archive', ayuda: 'Tipos de caja, cajas y estantes', roles: ['Enfermera', 'IT'] },
    ],
  },
  {
    titulo: 'Gestión',
    items: [
      { ruta: '/indicadores', nombre: 'Indicadores', icono: 'fa-gauge-high', ayuda: 'Metas del proyecto' },
      { ruta: '/reportes', nombre: 'Reportes', icono: 'fa-file-lines', ayuda: 'Exportar a Excel (CSV)', roles: ['Enfermera', 'IT'] },
      { ruta: '/usuarios', nombre: 'Usuarios', icono: 'fa-users-gear', ayuda: 'Crear cuentas y resetear claves', roles: ['IT'] },
      { ruta: '/auditoria', nombre: 'Auditoría', icono: 'fa-user-shield', ayuda: 'Quién hizo qué y cuándo', roles: ['IT'] },
    ],
  },
];

export const pantallaDe = (ruta) => SECCIONES.flatMap((s) => s.items).find((i) => i.ruta === ruta);
export const puedeVer = (item, rol) => !item?.roles || item.roles.includes(rol);
