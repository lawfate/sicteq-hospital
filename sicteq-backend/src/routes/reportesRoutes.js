const express = require('express');
const router = express.Router();
const { requireRole, ROLES } = require('../middleware/authMiddleware');

const { getReporteTrazabilidad, getReporteVinculos, getReporteTiempos } = require('../controllers/reportesController');

router.get('/trazabilidad', requireRole(...ROLES.reportes), getReporteTrazabilidad);
router.get('/vinculos', requireRole(...ROLES.datosPaciente), getReporteVinculos);
router.get('/tiempos', requireRole(...ROLES.reportes), getReporteTiempos);

module.exports = router;
