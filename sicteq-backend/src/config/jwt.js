// Si JWT_SECRET no está seteado (p. ej. quedó pendiente en Render) el
// servidor sigue levantando con este valor de respaldo en vez de morir en
// producción -- pero firmar tokens con un secreto conocido en el código
// invalida la protección, así que avisamos fuerte en el log.
const JWT_SECRET = process.env.JWT_SECRET || (() => {
    console.warn('>>> [ADVERTENCIA] JWT_SECRET no está configurado. Usando un secreto de respaldo inseguro -- configura JWT_SECRET en las variables de entorno de Render.');
    return 'sicteq-dev-fallback-secret-inseguro-configurar-en-produccion';
})();

const JWT_EXPIRES_IN = '8h';

module.exports = { JWT_SECRET, JWT_EXPIRES_IN };
