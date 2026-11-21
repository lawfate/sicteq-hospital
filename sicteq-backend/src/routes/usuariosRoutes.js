const router = require('express').Router();
const { getRoles, getUsuarios, crearUsuario, actualizarActivo, resetearClave } = require('../controllers/usuariosController');

router.get('/roles', getRoles);
router.get('/', getUsuarios);
router.post('/', crearUsuario);
router.put('/:id/activo', actualizarActivo);
router.post('/:id/resetear', resetearClave);

module.exports = router;
