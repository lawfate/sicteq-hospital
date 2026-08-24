const express = require('express');
const router = express.Router();
const { getCajasEnCirculacion, getPacientesDeCaja } = require('../controllers/cajaFisicaController');

router.get('/circulacion', getCajasEnCirculacion);
router.get('/:codigo/pacientes', getPacientesDeCaja);

module.exports = router;
