const express = require('express');
const router = express.Router();
// Importamos las funciones desde el controlador real
const { buscarFolio, actualizarEtapa } = require('../controllers/trazabilidadController');

router.get('/buscar/:id', buscarFolio);
router.post('/actualizar', actualizarEtapa);

module.exports = router;