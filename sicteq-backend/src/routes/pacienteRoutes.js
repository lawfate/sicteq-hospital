const express = require('express');
const router = express.Router();
const { requireRole, ROLES } = require('../middleware/authMiddleware');
const { getPacientes, getPacienteDetalle } = require('../controllers/pacienteController');

router.get('/', requireRole(...ROLES.datosPaciente), getPacientes);
router.get('/:rut', requireRole(...ROLES.datosPaciente), getPacienteDetalle);

module.exports = router;
