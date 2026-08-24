const express = require('express');
const router = express.Router();
// Importamos las funciones desde el controlador real
const { buscarCaja, actualizarEtapa } = require('../controllers/trazabilidadController');

router.get('/buscar/:codigo', buscarCaja);
router.post('/actualizar', actualizarEtapa);

module.exports = router;
