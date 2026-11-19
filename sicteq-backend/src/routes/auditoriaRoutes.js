const express = require('express');
const router = express.Router();
const { getAuditoria } = require('../controllers/auditoriaController');
const { requireRole, ROLES } = require('../middleware/authMiddleware');

router.get('/', requireRole(...ROLES.auditoria), getAuditoria);

module.exports = router;
