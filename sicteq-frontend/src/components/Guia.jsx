import { useEffect, useRef, useState } from 'react';
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

export default function Guia({ rol, onCerrar }) {
  const [paso, setPaso] = useState(0);
  const botonPrincipalRef = useRef(null);
  const pasosRol = PASOS_POR_ROL[rol] || [];
  const pasos = [BIENVENIDA, ...pasosRol, CUENTA];
  const pasoActual = pasos[paso];
  const ultimoPaso = paso === pasos.length - 1;

  useEffect(() => {
    botonPrincipalRef.current?.focus();

    const manejarTecla = (evento) => {
      if (evento.key === 'Escape') onCerrar();
    };

    window.addEventListener('keydown', manejarTecla);
    return () => window.removeEventListener('keydown', manejarTecla);
  }, [onCerrar]);

  const siguiente = () => {
    if (ultimoPaso) {
      onCerrar();
      return;
    }
    setPaso((actual) => actual + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guia-titulo"
        className="relative w-full max-w-[32rem] rounded-lg border border-border bg-card p-5 sm:p-6"
      >
        <button
          type="button"
          onClick={onCerrar}
          className="absolute right-4 top-4 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          Saltar guía
        </button>

        <div className="pr-24">
          <div className="rounded-md border border-border bg-background p-5">
            <h2 id="guia-titulo" className="mb-2 text-lg font-bold">
              {pasoActual.titulo}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">{pasoActual.texto}</p>
          </div>
        </div>

        <p className="my-4 text-sm text-muted-foreground">
          Paso {paso + 1} de {pasos.length}
        </p>

        <div className="flex items-center justify-end gap-3">
          {paso > 0 && (
            <Button variant="ghost" onClick={() => setPaso((actual) => actual - 1)}>
              Anterior
            </Button>
          )}
          <Button ref={botonPrincipalRef} onClick={siguiente}>
            {ultimoPaso ? 'Empezar' : 'Siguiente'}
          </Button>
        </div>
      </div>
    </div>
  );
}
