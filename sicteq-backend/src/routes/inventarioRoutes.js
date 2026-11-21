const express = require('express');
const router = express.Router();
const { getInventario, getCategorias, guardarInventario } = require('../controllers/inventarioController');
const { requireRole, ROLES } = require('../middleware/authMiddleware');

router.get('/', getInventario);
router.get('/categorias', getCategorias);
router.post('/', requireRole(...ROLES.catalogo), guardarInventario);
router.put('/:id', requireRole(...ROLES.catalogo), guardarInventario);

module.exports = router;
