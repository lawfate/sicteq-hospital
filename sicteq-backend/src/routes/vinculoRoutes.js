const express = require('express');
const router = express.Router();
const { requireRole, ROLES } = require('../middleware/authMiddleware');
const { crearVinculo } = require('../controllers/vinculoController');

router.post('/', requireRole(...ROLES.datosPaciente), crearVinculo);

module.exports = router;
