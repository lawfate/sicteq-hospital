const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;

// Importación de rutas
const areaRoutes = require('./routes/areaRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const metricsRoutes = require('./routes/metricsRoutes');
const trazabilidadRoutes = require('./routes/trazabilidadRoutes');
const authRoutes = require('./routes/authRoutes');
const solicitudesRoutes = require('./routes/solicitudesRoutes');
const inventarioRoutes = require('./routes/inventarioRoutes');

// Middlewares
app.use(cors({
    origin: [
        'https://sicteq-frontend.vercel.app', 
        'https://sicteq-hospital-dqlo-9ht49ncuw-diegoalarcon42-6755s-projects.vercel.app', 
        'http://localhost:5173'
    ], 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json()); // NECESARIO para procesar peticiones JSON

// Rutas
app.use('/api/metrics', metricsRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/trazabilidad', trazabilidadRoutes);
app.use('/api/auth', authRoutes); 
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/inventario', inventarioRoutes);

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