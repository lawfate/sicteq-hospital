const express = require('express');
const router = express.Router();
const { getCajasEnCirculacion } = require('../controllers/cajaFisicaController');

router.get('/circulacion', getCajasEnCirculacion);

module.exports = router;
