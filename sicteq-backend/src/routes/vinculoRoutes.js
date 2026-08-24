const express = require('express');
const router = express.Router();
const { crearVinculo } = require('../controllers/vinculoController');

router.post('/', crearVinculo);

module.exports = router;
