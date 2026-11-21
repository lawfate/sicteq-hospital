const express = require('express');
const router = express.Router();
const { requireRole, ROLES } = require('../middleware/authMiddleware');

// Importación de las funciones desde el controlador de solicitudes
const { getSolicitudes, getAreas, crearSolicitud, despacharSolicitud } = require('../controllers/solicitudesController');

// Definición de las rutas
router.get('/areas', getAreas);
router.get('/', getSolicitudes);
router.post('/', requireRole(...ROLES.solicitar), crearSolicitud);

// Ruta para despachar la solicitud (utilizando el método PUT)
router.put('/:id/despachar', requireRole(...ROLES.despachar), despacharSolicitud);

module.exports = router;