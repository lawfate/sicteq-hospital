const express = require('express');
const router = express.Router();
const { requireRole, ROLES } = require('../middleware/authMiddleware');

const { getReporteTrazabilidad, getReporteVinculos } = require('../controllers/reportesController');

router.get('/trazabilidad', requireRole(...ROLES.reportes), getReporteTrazabilidad);
router.get('/vinculos', requireRole(...ROLES.datosPaciente), getReporteVinculos);

module.exports = router;
