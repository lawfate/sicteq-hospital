# SICTEQ — Trazabilidad de instrumental quirúrgico

Sistema para la Central de Esterilización del Hospital Dr. Franco Ravera Zunino, Rancagua. Registra el recorrido de cada caja, cargas de autoclave, entregas a pabellón y vínculos con pacientes. Proyecto de título de Diego Alarcón, INACAP.

## Accesos

- Aplicación: https://sicteq-hospital.dhiegho122.workers.dev
- API: https://sicteq-backend.onrender.com
- Salud del servidor: https://sicteq-backend.onrender.com/api/health
- Repositorio público: https://github.com/lawfate/sicteq-hospital

El entorno de demostración contiene datos ficticios. Las cuentas de demostración se entregan por separado en el kit de acceso. Las credenciales de infraestructura, archivos de entorno y respaldos se mantienen fuera del repositorio.

## Estructura

```text
sicteq-frontend/           React 19, Vite y Tailwind
  src/components/         Pantallas y componentes de interfaz
  src/navegacion.js       Menú y permisos visibles por rol
  src/api.js              Peticiones con token de sesión
  src/useReporte.js       Consultas y cancelación de respuestas antiguas
  src/xlsx.js             Exportación Excel sin dependencias adicionales
  wrangler.jsonc          Frontend en Cloudflare Workers
sicteq-backend/            Express y PostgreSQL (Neon)
  src/routes/             Rutas de la API
  src/controllers/        Validaciones y operaciones
  src/middleware/         Autenticación, roles y restricciones de IP
  migrations/             Cambios de esquema aditivos e idempotentes
  pruebas/                Pruebas y datos de demostración
  respaldo/               Respaldo y restauración con verificación
.github/workflows/        CI, respaldo diario y comprobaciones de salud
```

## Roles y permisos

| Función | TENS | Enfermería | IT |
| --- | --- | --- | --- |
| Panel, seguimiento, inventario, etiquetas e indicadores | Sí | Sí | Sí |
| Registrar cargas de autoclave | Sí | Sí | Sí |
| Registrar resultado y liberar cargas | No | Sí | Sí |
| Entregar pedidos a pabellón | Sí | No | Sí |
| Crear pedidos y consultar Mis pedidos | No | Sí | Sí |
| Ver pacientes y registrar vínculos clínicos | No | Sí | Sí |
| Mantener catálogo de cajas y estantes | No | Sí | Sí |
| Resolver incidencias de piezas | No | Sí | Sí |
| Reportes y exportación Excel/CSV | No | Sí | Sí |
| Usuarios y auditoría | No | No | Sí |

El nombre interno del rol de Enfermería es `Enfermera`. El backend valida los permisos en cada operación. La interfaz muestra las pantallas correspondientes al rol.

## Levantar en local (PowerShell)

Usar Node.js 24 y npm. En Windows, usar `npm.cmd` y `npx.cmd` si PowerShell bloquea los archivos `.ps1`.

Instalar dependencias desde la raíz:

```powershell
npm.cmd --prefix sicteq-backend ci
npm.cmd --prefix sicteq-frontend ci
```

Solicitar al administrador los archivos locales de configuración:

- Backend `.env`: `DATABASE_URL` y `JWT_SECRET` (mínimo 32 caracteres). Opcionales: `PORT` y `CORS_ORIGINS` (orígenes permitidos separados por coma).
- Backend `.env.pruebas`: `DATABASE_URL` de la rama Neon `dev-sprint-nov` (host que empieza por `ep-odd-art`).
- Frontend: `VITE_API_URL=http://localhost:4000` para desarrollo o la URL pública de Render para publicar. Esta variable es pública y queda incluida al compilar.

Iniciar el backend **contra la base de pruebas**, desde `sicteq-backend`:

```powershell
$env:DATABASE_URL = node -e "process.stdout.write(require('dotenv').parse(require('fs').readFileSync('.env.pruebas')).DATABASE_URL)"
node src/server.js
```

La asignación carga la URL sin mostrarla. El resto de la configuración se obtiene de `.env`. El `.env` habitual apunta a producción: iniciar el backend sin esta asignación lo conectaría a producción. Verificar el destino antes de realizar operaciones.

En otra terminal, desde `sicteq-frontend`:

```powershell
$env:VITE_API_URL = 'http://localhost:4000'
npx.cmd vite --host 127.0.0.1 --port 5173
```

Abrir http://localhost:5173. Una base nueva necesita `schema.sql` y las migraciones, sobre el destino elegido por el administrador. No es necesario recrear la rama de pruebas existente.

## Pruebas sin base

Desde `sicteq-frontend`:

```powershell
npm.cmd run lint -- --max-warnings=0
npm.cmd run build
node src/xlsx.test.mjs
```

Desde `sicteq-backend`:

```powershell
Get-ChildItem -Recurse src -Filter *.js | ForEach-Object {
    node --check $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Sintaxis inválida en $($_.Name)" }
}
node pruebas/rut_clave.test.js
```

`.github/workflows/ci.yml` instala con `npm ci` y ejecuta lint sin advertencias, compilación, Excel, sintaxis del backend y RUT/claves en cada push y pull request. No requiere credenciales ni conexión a la base.

## Pruebas con base (escriben datos)

Solo usar la rama `dev-sprint-nov`, con el backend local conectado a ella. Desde `sicteq-backend`, cargar `DATABASE_URL` desde `.env.pruebas` como en el inicio local; mantener `API_URL=http://localhost:4000`:

```powershell
$env:API_URL = 'http://localhost:4000'
node pruebas/casos_prueba.js --confirmo-base-de-pruebas
node pruebas/tanda3.js --confirmo-base-de-pruebas
node pruebas/tanda4.js --confirmo-base-de-pruebas
node pruebas/seguridad.js --confirmo-base-de-pruebas
node pruebas/evidencias.js --confirmo-base-de-pruebas
node pruebas/seed_mock.js --confirmo-base-de-pruebas
```

Ejecutar las suites una por una. Al terminar, incluso si alguna falla después de escribir, recargar el mock para dejar la rama de pruebas utilizable. El script de evidencias usa `DATABASE_URL` del entorno; el flag por sí solo no cambia la base. Nunca ejecutar el mock, restauraciones o pruebas de escritura en producción sin autorización explícita y respaldo previo. Las pruebas con base no forman parte del CI automático.

## Despliegue

Render y Cloudflare despliegan desde `chore/limpieza-y-fixes-agosto`. `main` se utiliza para los workflows programados; estos deben mantenerse allí para que se ejecuten por horario.

1. Actualizar referencias y crear una rama nueva desde `origin/chore/limpieza-y-fixes-agosto`.
2. Realizar los cambios, pasar las pruebas y crear el commit con la autoría de Diego.
3. Si hay migración, pedir autorización para escribir en producción. Desde `sicteq-backend`, respaldar con `node respaldo/respaldo.js <carpeta-segura>` y aplicar después `node migrations/aplicar.js` sobre producción. **Hacerlo antes de unir el PR**.
4. Subir la rama usando la cuenta personal `lawfate`:

```powershell
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -u origin <rama>
gh pr create -R lawfate/sicteq-hospital --base chore/limpieza-y-fixes-agosto --head <rama> --title '<titulo>' --body-file <archivo-descripcion>
gh pr merge -R lawfate/sicteq-hospital <rama> --merge
```

5. Confirmar que el CI pasó y que los despliegues terminaron. Cloudflare suele demorar cerca de un minuto y Render entre tres y cinco. Revisar `/api/health` y comprobar que el JS publicado contiene una cadena propia del cambio. La salud del servidor no identifica por sí sola la versión publicada.

La verificación autenticada también escribe actividad de sesión en la base: requiere autorización previa si se hace en producción. Se pueden comprobar salud y archivos públicos sin iniciar sesión.

## Respaldo diario

`respaldo-diario.yml` está preparado para respaldar a las 07:00 UTC, conservar artifacts cifrados durante 30 días y probar una restauración mensual en una base desechable. Necesita los secrets `DATABASE_URL`, `BACKUP_PASSPHRASE` y `RESTORE_DATABASE_URL`. El horario local cambia con la hora de Chile: 07:00 UTC corresponde a las 04:00 en UTC−3 y a las 03:00 en UTC−4.

La existencia del workflow no demuestra que el último respaldo haya funcionado. Revisar las ejecuciones y guardar la clave de cifrado fuera de GitHub. La restauración borra el destino; nunca usar producción como base de prueba de restauración.
