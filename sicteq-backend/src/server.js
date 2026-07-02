const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const areaRoutes = require('./routes/areaRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes'); // Ya lo tenías importado
const metricsRoutes = require('./routes/metricsRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
    origin: ['https://sicteq-frontend.vercel.app', 'http://localhost:5173'], 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use('/api/metrics', metricsRoutes);
app.use('/api/areas', areaRoutes);

// --- AQUÍ ESTABA LA PIEZA QUE FALTABA ---
app.use('/api/dashboard', dashboardRoutes); 
// ----------------------------------------

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        mensaje: 'Servidor SICTEQ-Hospital funcionando correctamente',
        timestamp: new Date()
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});