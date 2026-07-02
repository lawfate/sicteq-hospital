const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Ruta para obtener el resumen principal del dashboard
router.get('/', dashboardController.getDashboardData);

// Ruta para obtener el historial detallado de una caja (Opción A)
router.get('/movimientos/:id', dashboardController.getHistorialCaja); 

module.exports = router;