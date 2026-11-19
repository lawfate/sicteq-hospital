const express = require('express');
const router = express.Router();
const { requireRole, ROLES } = require('../middleware/authMiddleware');
const { getCajasEnCirculacion, getPacientesDeCaja } = require('../controllers/cajaFisicaController');

router.get('/circulacion', getCajasEnCirculacion);
router.get('/:codigo/pacientes', requireRole(...ROLES.datosPaciente), getPacientesDeCaja);

module.exports = router;
