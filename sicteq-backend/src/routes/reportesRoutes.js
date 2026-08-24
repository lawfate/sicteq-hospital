const express = require('express');
const router = express.Router();

const { getReporteTrazabilidad, getReporteVinculos } = require('../controllers/reportesController');

router.get('/trazabilidad', getReporteTrazabilidad);
router.get('/vinculos', getReporteVinculos);

module.exports = router;
