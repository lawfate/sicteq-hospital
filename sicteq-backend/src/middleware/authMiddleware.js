const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET } = require('../config/jwt');

// PB-02: requisito de calidad del hospital (reunión 31-08): cierre a los
// 30 minutos sin uso y sin sesiones simultáneas del mismo usuario.
const INACTIVIDAD_MINUTOS = 30;

// Lo único permitido con una clave temporal: cambiarla o salir.
const RUTAS_CON_CLAVE_TEMPORAL = ['/api/auth/cambiar-clave', '/api/auth/logout'];

// Exige un Bearer token válido para todo lo que no sea login/health, y además
// que sea la sesión vigente del usuario (la del último login) y que no lleve
// más de 30 min sin uso. Cada petición válida renueva la actividad.
const requireAuth = async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'No autenticado: falta el token de sesión.', motivo: 'sin_token' });
    }

    let payload;
    try {
        payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.', motivo: 'token_invalido' });
    }

    try {
        // Un solo UPDATE en el camino feliz: renueva la actividad solo si la
        // sesión es la vigente y no está inactiva.
        const ok = await db.query(
            `UPDATE usuario SET ultima_actividad = NOW()
             WHERE id = $1 AND activo = true AND sesion_id = $2
               AND ultima_actividad > NOW() - make_interval(mins => $3)
             RETURNING debe_cambiar_clave`,
            [payload.id, payload.sid || null, INACTIVIDAD_MINUTOS]
        );

        if (ok.rowCount === 0) {
            const u = await db.query('SELECT sesion_id, activo FROM usuario WHERE id = $1', [payload.id]);
            const fila = u.rows[0];
            if (!fila || !fila.activo) {
                return res.status(401).json({ error: 'Usuario inactivo.', motivo: 'usuario_inactivo' });
            }
            if (fila.sesion_id !== payload.sid) {
                return res.status(401).json({ error: 'Tu sesión se cerró porque se inició sesión con tu cuenta en otro equipo.', motivo: 'sesion_reemplazada' });
            }
            return res.status(401).json({ error: `Sesión cerrada por ${INACTIVIDAD_MINUTOS} minutos de inactividad.`, motivo: 'inactividad' });
        }

        req.user = payload;
        // Cuenta nueva o reseteada por IT: no puede hacer nada hasta cambiar la clave.
        if (ok.rows[0].debe_cambiar_clave && !RUTAS_CON_CLAVE_TEMPORAL.includes(req.originalUrl.split('?')[0])) {
            return res.status(403).json({ error: 'Debe cambiar su clave temporal antes de continuar.', motivo: 'cambiar_clave' });
        }
        next();
    } catch (err) {
        console.error('Error validando sesión:', err);
        res.status(500).json({ error: 'Error interno al validar la sesión.' });
    }
};

// PB-02: permisos por rol en el backend (antes solo se escondían botones en
// el frontend, evadible llamando directo a la API).
const requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
        return res.status(403).json({ error: `Tu rol (${req.user?.rol || 'desconocido'}) no tiene permiso para esta acción.` });
    }
    next();
};

// Matriz de permisos en un solo lugar (ajustar aquí si el hospital la cambia).
const ROLES = {
    datosPaciente: ['Enfermera', 'IT'],   // RUT, ficha y vínculos clínicos
    solicitar: ['Enfermera', 'IT'],
    despachar: ['TENS', 'IT'],
    liberarCarga: ['Enfermera', 'IT'],    // resultado del ciclo de autoclave
    reportes: ['Enfermera', 'IT'],        // acceso a reportes
    auditoria: ['IT'],
    usuarios: ['IT'],                     // crear, desactivar y resetear cuentas
    catalogo: ['Enfermera', 'IT'],        // tipos de caja, cajas físicas y estantes
    incidencias: ['Enfermera', 'IT'],     // resolver piezas faltantes
};

module.exports = { requireAuth, requireRole, ROLES, INACTIVIDAD_MINUTOS };
