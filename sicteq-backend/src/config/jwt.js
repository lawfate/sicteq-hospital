// PB-03: sin secreto de respaldo. Un secreto escrito en el código (público en
// el repo) permite a cualquiera fabricar tokens válidos, así que el servidor
// se niega a arrancar si JWT_SECRET no está configurado (en Render:
// Dashboard -> sicteq-backend -> Environment).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET no está configurado (o tiene menos de 32 caracteres). Configúralo en las variables de entorno antes de iniciar el servidor.');
}

const JWT_EXPIRES_IN = '8h';

module.exports = { JWT_SECRET, JWT_EXPIRES_IN };
