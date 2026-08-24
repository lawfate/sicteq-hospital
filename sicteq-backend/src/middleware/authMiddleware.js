const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

// Exige un Bearer token válido para todo lo que no sea login/health. Antes
// ningún endpoint validaba sesión: se podía leer y escribir trazabilidad,
// pacientes, vínculos e inventario sin credenciales, con solo conocer la
// URL del backend.
const requireAuth = (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'No autenticado: falta el token de sesión.' });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.' });
    }
};

module.exports = { requireAuth };
