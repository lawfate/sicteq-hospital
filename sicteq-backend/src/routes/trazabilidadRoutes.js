const express = require('express');
const router = express.Router();
const trazabilidadController = require('../controllers/trazabilidadController');

router.get('/buscar/:id', trazabilidadController.buscarFolio);
router.post('/actualizar', trazabilidadController.actualizarEtapa);

module.exports = router;