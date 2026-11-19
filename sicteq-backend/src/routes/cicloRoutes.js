const express = require('express');
const router = express.Router();
const { listarCiclos, detalleCiclo, crearCiclo, registrarResultado } = require('../controllers/cicloController');
const { requireRole, ROLES } = require('../middleware/authMiddleware');

router.get('/', listarCiclos);
router.get('/:id', detalleCiclo);
router.post('/', crearCiclo);
router.put('/:id/resultado', requireRole(...ROLES.liberarCarga), registrarResultado);

module.exports = router;
