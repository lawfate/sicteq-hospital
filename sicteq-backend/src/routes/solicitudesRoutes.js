const express = require('express');
const router = express.Router();

// Importación de las funciones desde el controlador de solicitudes
const { getAreas, crearSolicitud, despacharSolicitud } = require('../controllers/solicitudesController');

// Definición de las rutas
router.get('/areas', getAreas);
router.post('/', crearSolicitud);

// Ruta para despachar la solicitud (utilizando el método PUT)
router.put('/:id/despachar', despacharSolicitud); 

module.exports = router;