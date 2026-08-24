const express = require('express');
const router = express.Router();

const { getAlertas } = require('../controllers/alertasController');

router.get('/', getAlertas);

module.exports = router;
