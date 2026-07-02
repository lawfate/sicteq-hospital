const express = require('express');
const router = express.Router();
// Importamos la función que acabas de escribir en el controlador
const { getDashboardData } = require('../controllers/dashboardController');

// Definimos que cuando alguien llame a /api/dashboard/, ejecute esa función
router.get('/', getDashboardData);

module.exports = router;