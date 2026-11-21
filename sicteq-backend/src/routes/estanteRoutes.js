const router = require('express').Router();
const { requireRole, ROLES } = require('../middleware/authMiddleware');
const { getEstantes, crearEstante } = require('../controllers/estanteController');

router.get('/', getEstantes);
router.post('/', requireRole(...ROLES.catalogo), crearEstante);

module.exports = router;
