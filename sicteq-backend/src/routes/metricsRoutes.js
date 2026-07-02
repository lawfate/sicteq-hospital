const express = require('express');
const router = express.Router();
const { getDashboardMetrics } = require('../controllers/metricsController');

router.get('/', getDashboardMetrics);

module.exports = router;