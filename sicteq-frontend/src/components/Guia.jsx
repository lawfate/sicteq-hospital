import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const BIENVENIDA = {
  titulo: 'Bienvenida a SICTEQ',
  texto: 'Aquí queda registrado el recorrido de cada caja de instrumental: desde que vuelve de pabellón hasta que sale estéril de nuevo.',
};

const PASOS_POR_ROL = {
  TENS: [
    {
      titulo: 'Escanee desde cualquier pantalla',
      texto: 'Arriba hay un campo para escanear: la pistola lee la etiqueta y se abre la caja con su historial y su siguiente paso.',
    },
    {
      titulo: 'Modo estación',
      texto: 'En Seguimiento de cajas, elija dónde está (Recepción, Lavado, Preparación o Bodega) y escanee caja tras caja. Un bip agudo: quedó registrada. Dos graves: revise el mensaje.',
    },
    {
      titulo: 'Recepción: cuente las piezas',
      texto: 'Al recibir una caja se indica cuántas piezas trae. Si está completa, presione Enter. Si faltan, quedará una incidencia para Enfermería.',
    },
    {
      titulo: 'Autoclave y bodega',
      texto: 'Arme las cargas en Cargas de autoclave. Al guardar en bodega, escanee las cajas y luego la etiqueta del estante (EST-…).',
    },
    {
      titulo: 'Entrega a pabellón',
      texto: 'Los pedidos aparecen con las urgencias primero. Escanee una caja del tipo pedido: el sistema no deja salir una caja vencida, no estéril o de otro tipo.',
    },
  ],
  Enfermera: [
    {
      titulo: 'Pida cajas para cirugía',
      texto: 'En Pedidos de pabellón elija la caja del catálogo. En Mis pedidos ve si ya fue entregada y con qué caja.',
    },
    {
      titulo: 'Libere las cargas de autoclave',
      texto: 'En Cargas de autoclave registre el resultado: Estéril, o No estéril con su causa (las cajas vuelven a Lavado).',
    },
    {
      titulo: 'Vincule la caja con el paciente',
      texto: 'En Vínculo con paciente quede registro de qué caja se usó con qué paciente.',
    },
    {
      titulo: 'Revise lo que requiere atención',
      texto: 'El Panel avisa piezas faltantes, empaques por vencer y cargas sin resultado. Las piezas faltantes se resuelven ahí mismo, anotando qué se hizo.',
    },
    {
      titulo: 'Catálogo y reportes',
      texto: 'En Catálogo de cajas se agregan tipos, cajas y estantes. En Reportes puede exportar a Excel y ver los tiempos por etapa.',
    },
  ],
  IT: [
    {
      titulo: 'Cuentas del personal',
      texto: 'En Usuarios cree cada cuenta con el RUT. El sistema entrega una clave temporal que la persona cambia al entrar.',
    },
    {
      titulo: 'Auditoría',
      texto: 'Queda registrado quién hizo qué y cuándo: ingresos, cambios de etapa, entregas y cambios de cuentas.',
    },
    {
      titulo: 'Catálogo y reportes',
      texto: 'Mantenga el catálogo de cajas y estantes, y exporte reportes a Excel o CSV.',
    },
  ],
};

const CUENTA = {
  titulo: 'Su cuenta',
  texto: 'Cada persona entra con su propia cuenta. La sesión se cierra sola tras 30 minutos sin uso. Puede cambiar su clave en Cambiar mi clave y volver a ver esta guía con el botón Ayuda.',
};

const DESTINOS = {
  TENS: ['/ciclo', '/ciclo?modo=estacion', '/ciclo?modo=estacion', '/autoclave', '/entrega'],
  Enfermera: ['/solicitudes', '/autoclave', '/vinculo', '/', '/catalogo'],
  IT: ['/usuarios', '/auditoria', '/catalogo'],
};
const EJEMPLOS = {
  TENS: [
    ['Busque la etiqueta CAJA-…', 'Escanee o escriba el código y toque Buscar', 'Revise la etapa y el siguiente paso'],
    ['Elija dónde está trabajando', 'Escanee una caja y espere la respuesta', 'Revise el mensaje antes de continuar'],
    ['Compare el contenido con el total esperado', 'Escriba las piezas que realmente recibió', 'Confirme: los faltantes quedan avisados'],
    ['Agrupe las cajas en una carga', 'Enfermería registra el resultado', 'Al guardar, registre también el estante'],
    ['Abra el pedido por atender', 'Revise el tipo de caja solicitado', 'Escanee y confirme la entrega'],
  ],
  Enfermera: [
    ['Elija pabellón y tipo de cirugía', 'Busque el instrumental en el catálogo', 'Siga el avance desde Mis pedidos'],
    ['Abra la carga pendiente', 'Revise los controles del ciclo', 'Registre el resultado correspondiente'],
    ['Identifique al paciente', 'Escanee la caja utilizada', 'Revise los datos y confirme el vínculo'],
    ['Revise urgencias y pendientes', 'Abra la carga o caja que necesita atención', 'Anote qué se hizo al resolver un faltante'],
    ['Mantenga cajas y estantes en el catálogo', 'Revise los filtros del reporte', 'Descargue los datos que necesita'],
  ],
  IT: [
    ['Cada persona usa su propia cuenta', 'Cree el usuario y seleccione su rol', 'Entregue la clave temporal de forma privada'],
    ['Seleccione fechas y filtros', 'Revise quién hizo cada cambio', 'Exporte si necesita conservar la revisión'],
    ['Revise tipos de caja y estantes', 'Abra el reporte que necesita', 'Aplique filtros antes de exportar'],
  ],
};

export default function Guia({ rol, onCerrar }) {
  const navigate = useNavigate();
  const [paso, setPaso] = useState(0);
  const dialogoRef = useRef(null);
  const cerrarRef = useRef(onCerrar);
  const botonPrincipalRef = useRef(null);
  const pasosRol = PASOS_POR_ROL[rol] || [];
  const pasos = [BIENVENIDA, ...pasosRol, CUENTA];
  const pasoActual = pasos[paso];
  const ultimoPaso = paso === pasos.length - 1;
  const tareas = EJEMPLOS[rol]?.[paso - 1];
  const destino = DESTINOS[rol]?.[paso - 1];

  useEffect(() => { cerrarRef.current = onCerrar; }, [onCerrar]);

  useEffect(() => {
    const anterior = document.activeElement;
    botonPrincipalRef.current?.focus();

    const manejarTecla = (evento) => {
      if (evento.key === 'Escape') cerrarRef.current();
      if (evento.key === 'Tab') {
        const botones = [...dialogoRef.current.querySelectorAll('button:not(:disabled)')];
        const primero = botones[0];
        const ultimo = botones.at(-1);
        if (evento.shiftKey && document.activeElement === primero) { evento.preventDefault(); ultimo.focus(); }
        else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primero.focus(); }
      }
    };

    window.addEventListener('keydown', manejarTecla);
    return () => { window.removeEventListener('keydown', manejarTecla); if (anterior?.isConnected) anterior.focus(); };
  }, []);

  useEffect(() => { dialogoRef.current?.scrollTo(0, 0); }, [paso]);

  const siguiente = () => {
    if (ultimoPaso) {
      onCerrar();
      return;
    }
    setPaso((actual) => actual + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-3 backdrop-blur-sm sm:p-6">
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guia-titulo"
        aria-describedby="guia-texto"
        className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-[1.75rem] border border-primary/20 bg-card shadow-soft"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <span className="text-sm font-bold text-primary">Su recorrido · {rol === 'Enfermera' ? 'Enfermería' : rol}</span>
        <button
          type="button"
          onClick={onCerrar}
          className="min-h-11 rounded-md px-3 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Cerrar recorrido
        </button>
        </div>
        <div className="grid sm:grid-cols-[11rem_1fr]">
          <nav aria-label="Pasos del recorrido" className="flex gap-1 overflow-x-auto border-b border-border bg-muted/30 p-3 sm:flex-col sm:border-b-0 sm:border-r">
            {pasos.map((p, i) => <button key={p.titulo} aria-current={paso === i ? 'step' : undefined} onClick={() => setPaso(i)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg p-2 text-left text-sm ${paso === i ? 'bg-primary/15 font-bold text-primary' : 'text-muted-foreground hover:bg-muted'}`}><span className="font-mono">{i + 1}.</span><span className="hidden sm:inline">{i === 0 ? 'Para comenzar' : i === pasos.length - 1 ? 'Su cuenta y ayuda' : p.titulo}</span><span className="sr-only sm:hidden">{p.titulo}</span></button>)}
          </nav>
          <div className="space-y-5 p-5 sm:p-6" aria-live="polite">
            {paso === 0 ? <div className="flex h-36 items-end justify-center overflow-hidden rounded-lg bg-gradient-to-br from-accent/10 to-lavender/15"><img src="/ilustraciones/equipo-esterilizacion.png" alt="" width="1392" height="1136" className="h-36 w-48 object-contain object-bottom" /></div> : <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${ultimoPaso ? 'bg-accent/10 text-accent' : 'bg-lavender/10 text-lavender'}`}><i className={`fa-solid ${ultimoPaso ? 'fa-circle-check' : 'fa-clipboard-check'}`} aria-hidden="true" /></div>}
            <h2 id="guia-titulo" className="text-2xl font-bold">
              {pasoActual.titulo}
            </h2>
            <p id="guia-texto" className="leading-7 text-muted-foreground">{pasoActual.texto}</p>
            {tareas ? <ol className="space-y-3 rounded-xl border border-border bg-background p-4">{tareas.map((t, i) => <li key={t} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-sm font-bold text-primary">{i + 1}</span><span>{t}</span></li>)}</ol> : <div className="rounded-xl border border-primary/30 bg-primary/10 p-4"><p className="font-bold">{ultimoPaso ? 'La ayuda siempre está a mano' : 'Una tarea a la vez'}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{ultimoPaso ? 'Use Repetir recorrido en el Panel o en la cabecera. Puede revisar solo el paso que necesita.' : 'El Panel reúne los pendientes y accesos rápidos. El menú agrupa el trabajo con cajas, pabellón y consultas. Este recorrido solo explica: no registra movimientos.'}</p></div>}
            {destino && <Button variant="outline" className="h-auto min-h-11 whitespace-normal" onClick={() => { onCerrar(); navigate(destino); }}>Abrir esta pantalla <i className="fa-solid fa-arrow-right" aria-hidden="true" /></Button>}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4 sm:px-6">
        <p className="text-sm text-muted-foreground">
          Paso {paso + 1} de {pasos.length}
        </p>

        <div className="flex items-center justify-end gap-3">
          {paso > 0 && (
            <Button variant="ghost" onClick={() => setPaso((actual) => actual - 1)}>
              Anterior
            </Button>
          )}
          <Button ref={botonPrincipalRef} onClick={siguiente}>
            {ultimoPaso ? 'Terminar recorrido' : paso === 0 ? 'Comenzar recorrido' : 'Siguiente'}
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
}
