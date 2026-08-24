const express = require('express');
const router = express.Router();
const { getPacientes, getPacienteDetalle } = require('../controllers/pacienteController');

router.get('/', getPacientes);
router.get('/:rut', getPacienteDetalle);

module.exports = router;
