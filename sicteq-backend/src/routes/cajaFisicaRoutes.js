const express = require('express');
const router = express.Router();
const { requireRole, ROLES } = require('../middleware/authMiddleware');
const { getCajasEnCirculacion, getPacientesDeCaja, getCajas, getCaja, crearCaja, darBaja, ubicarCaja } = require('../controllers/cajaFisicaController');

router.get('/circulacion', getCajasEnCirculacion);
router.get('/:codigo/pacientes', requireRole(...ROLES.datosPaciente), getPacientesDeCaja);
router.get('/', getCajas);
router.post('/', requireRole(...ROLES.catalogo), crearCaja);
router.put('/:codigo/baja', requireRole(...ROLES.catalogo), darBaja);
router.put('/:codigo/estante', ubicarCaja);
router.get('/:codigo', getCaja);

module.exports = router;
