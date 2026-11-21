# AGENTS.md — SICTEQ

Instrucciones para agentes de código (Codex, Claude, Copilot) que trabajen en este repo.

## Proyecto
Trazabilidad de cajas de instrumental de una Central de Esterilización hospitalaria.
- `sicteq-frontend/`: React 19 + Vite + Tailwind. Componentes propios en `src/components/ui`. Colores SOLO con tokens (`bg-card`, `text-muted-foreground`, `text-ok`, `text-warn`, `text-danger`, `bg-primary`…) definidos en `src/index.css` (tema oscuro por defecto y `:root[data-tema='claro']`). Nada de colores sueltos.
- `sicteq-backend/`: Node + Express + pg (CommonJS). Consultas siempre parametrizadas. Roles en `src/middleware/authMiddleware.js` (`ROLES`, `requireRole`); el backend valida todo aunque el frontend esconda cosas.
- Migraciones aditivas e idempotentes en `sicteq-backend/migrations/` (`node migrations/aplicar.js`).

## Reglas de producto
- **Lo que un rol no puede usar no se le muestra**: ni ítem de menú, ni pestaña, ni botón, ni pantalla de "acceso restringido". Roles por pantalla en `sicteq-frontend/src/navegacion.js` (`roles`, `puedeVer`); una ruta ajena vuelve al Panel en silencio.
- Textos en español de Chile, simples, pensados para TENS y enfermería (no técnicos). Sin `alert()`: mensajes en pantalla con `role="status"`/`role="alert"`.
- Escaneo con pistola: los campos se limpian en cada escaneo, suenan con `src/sonido.js` (bip agudo = ok, dos graves = revisar) y nunca se pierde un escaneo en silencio.
- Fechas: la base guarda TIMESTAMP en UTC; se muestran con `toLocaleString('es-CL', …)`.

## Estilo de código
- El cambio más chico que resuelva todo. Reusar lo que ya existe (`apiFetch`, `moverCaja`, `fichaCaja` en `src/api.js`; `nombreEstado`, `etapaDe` en `src/etapas.js`).
- Sin dependencias nuevas salvo que no haya alternativa razonable (Excel y códigos de barras se generan con código propio).
- Comentarios cortos en español, solo el "por qué".
- Todo endpoint nuevo: validación de entrada (400), 404/409 cuando corresponda, auditoría (`src/utils/auditoria.js`) en escrituras, transacción con cliente dedicado si hay varias escrituras.

## Pruebas
- Frontend: `npx eslint src`, `npx vite build`, `node src/xlsx.test.mjs`.
- Backend sin base: `node --check` de cada archivo, `node pruebas/rut_clave.test.js`.
- Con base (ESCRIBEN DATOS): solo contra la rama de pruebas de Neon (`.env.pruebas`), con el flag `--confirmo-base-de-pruebas`: `pruebas/casos_prueba.js`, `pruebas/tanda3.js`, `pruebas/tanda4.js`, `pruebas/seguridad.js`, `pruebas/evidencias.js` (este con `DATABASE_URL` exportada desde `.env.pruebas`). Después, recargar el mock: `node pruebas/seed_mock.js --confirmo-base-de-pruebas`.
- Nunca escribir en la base de producción sin una instrucción explícita del dueño del proyecto, y siempre con respaldo previo (`node respaldo/respaldo.js <carpeta>`).

## Despliegue
- PR hacia `chore/limpieza-y-fixes-agosto` (la rama que despliegan Render y Cloudflare). Si el PR trae migración: aplicarla en producción ANTES de unirlo.
- Nunca subir `.env`, `.env.pruebas`, respaldos ni claves.
