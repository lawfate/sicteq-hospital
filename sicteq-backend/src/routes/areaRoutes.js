const express = require('express');
const router = express.Router();
const { obtenerAreas } = require('../controllers/areaController');

router.get('/', obtenerAreas);

module.exports = router;