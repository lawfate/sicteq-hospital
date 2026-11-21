const express = require('express');
const router = express.Router();
const { login, logout, cambiarClave } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/logout', requireAuth, logout);
router.post('/cambiar-clave', requireAuth, cambiarClave);

module.exports = router;
