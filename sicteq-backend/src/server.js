const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;

// Importación de rutas
const areaRoutes = require('./routes/areaRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const trazabilidadRoutes = require('./routes/trazabilidadRoutes');
const authRoutes = require('./routes/authRoutes');
const solicitudesRoutes = require('./routes/solicitudesRoutes');
const inventarioRoutes = require('./routes/inventarioRoutes');
const cajaFisicaRoutes = require('./routes/cajaFisicaRoutes');
const pacienteRoutes = require('./routes/pacienteRoutes');
const vinculoRoutes = require('./routes/vinculoRoutes');
const alertasRoutes = require('./routes/alertasRoutes');
const reportesRoutes = require('./routes/reportesRoutes');
const cicloRoutes = require('./routes/cicloRoutes');
const auditoriaRoutes = require('./routes/auditoriaRoutes');
const indicadoresRoutes = require('./routes/indicadoresRoutes');
const { requireAuth, requireRole, ROLES } = require('./middleware/authMiddleware');
const usuariosRoutes = require('./routes/usuariosRoutes');
const estanteRoutes = require('./routes/estanteRoutes');
const incidenciasRoutes = require('./routes/incidenciasRoutes');
const { restringirIP } = require('./middleware/ipMiddleware');

// PB-03: CORS solo para el frontend propio (antes '*'). Otros orígenes se
// pueden agregar con CORS_ORIGINS separados por coma.
const ORIGENES = (process.env.CORS_ORIGINS || 'https://sicteq-hospital.dhiegho122.workers.dev,http://localhost:5173')
    .split(',').map(s => s.trim()).filter(Boolean);

// Render está detrás de un proxy: así req.ip es la IP real del cliente (auditoría).
app.set('trust proxy', 1);

// Cabeceras de seguridad (revisión OWASP, PB-08). no-store: las respuestas traen
// datos de pacientes y no deben quedar en cachés del navegador ni de proxies.
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Strict-Transport-Security': 'max-age=31536000',
        'Cache-Control': 'no-store',
    });
    next();
});

// Middlewares
app.use(cors({
    origin: ORIGENES,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json()); // NECESARIO para procesar peticiones JSON
app.use(restringirIP);

// Rutas. /api/auth (login) y /api/health quedan públicas a propósito -- todo
// lo demás exige sesión real desde acá. Antes ningún endpoint la exigía.
app.use('/api/auth', authRoutes);
app.use('/api/areas', requireAuth, areaRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/trazabilidad', requireAuth, trazabilidadRoutes);
app.use('/api/solicitudes', requireAuth, solicitudesRoutes);
app.use('/api/inventario', requireAuth, inventarioRoutes);
app.use('/api/cajas', requireAuth, cajaFisicaRoutes);
app.use('/api/pacientes', requireAuth, pacienteRoutes);
app.use('/api/vinculos', requireAuth, vinculoRoutes);
app.use('/api/alertas', requireAuth, alertasRoutes);
app.use('/api/reportes', requireAuth, reportesRoutes);
app.use('/api/ciclos', requireAuth, cicloRoutes);
app.use('/api/auditoria', requireAuth, auditoriaRoutes);
app.use('/api/indicadores', requireAuth, indicadoresRoutes);
app.use('/api/usuarios', requireAuth, requireRole(...ROLES.usuarios), usuariosRoutes);
app.use('/api/estantes', requireAuth, estanteRoutes);
app.use('/api/incidencias', requireAuth, incidenciasRoutes);

// Ruta de Salud para probar que el servidor responde
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        mensaje: 'Servidor SICTEQ-Hospital funcionando correctamente',
        timestamp: new Date()
    });
});

// Errores que no atrapó ningún controlador (JSON mal formado, petición muy
// grande...). Sin esto Express responde una página HTML con el stack trace.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error('Error no controlado:', err);
    res.status(status).json({ error: status === 413 ? 'La petición es demasiado grande.' : status < 500 ? 'Petición mal formada.' : 'Error interno del servidor' });
});

// Inicio del Servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
