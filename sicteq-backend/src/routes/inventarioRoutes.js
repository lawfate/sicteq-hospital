const express = require('express');
const router = express.Router();
const { getInventario } = require('../controllers/inventarioController');

router.get('/', getInventario);

module.exports = router;