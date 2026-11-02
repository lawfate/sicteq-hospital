// PB-11: restricción por IP de origen. Se activa definiendo ALLOWED_IPS
// (IPs públicas de salida del hospital, separadas por coma). Sin la variable
// no restringe nada, para poder seguir probando desde cualquier red.
const permitidas = (process.env.ALLOWED_IPS || '').split(',').map(s => s.trim()).filter(Boolean);

const restringirIP = (req, res, next) => {
    if (permitidas.length === 0 || req.path === '/api/health') return next();
    const ip = (req.ip || '').replace(/^::ffff:/, '');
    if (permitidas.includes(ip)) return next();
    return res.status(403).json({ error: 'Acceso permitido solo desde la red del hospital.' });
};

module.exports = { restringirIP };
