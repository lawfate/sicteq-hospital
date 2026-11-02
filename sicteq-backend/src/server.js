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
const { requireAuth } = require('./middleware/authMiddleware');
const { restringirIP } = require('./middleware/ipMiddleware');

// PB-03: CORS solo para el frontend propio (antes '*'). Otros orígenes se
// pueden agregar con CORS_ORIGINS separados por coma.
const ORIGENES = (process.env.CORS_ORIGINS || 'https://sicteq-hospital.dhiegho122.workers.dev,http://localhost:5173')
    .split(',').map(s => s.trim()).filter(Boolean);

// Render está detrás de un proxy: así req.ip es la IP real del cliente (auditoría).
app.set('trust proxy', 1);

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

// Ruta de Salud para probar que el servidor responde
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        mensaje: 'Servidor SICTEQ-Hospital funcionando correctamente',
        timestamp: new Date()
    });
});

// Inicio del Servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});