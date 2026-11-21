const router = require('express').Router();
const { requireRole, ROLES } = require('../middleware/authMiddleware');
const { resolverIncidencia } = require('../controllers/incidenciasController');

router.put('/:id/resolver', requireRole(...ROLES.incidencias), resolverIncidencia);

module.exports = router;
