const { Pool, types } = require('pg');
require('dotenv').config();

// Las columnas son TIMESTAMP sin zona y se llenan con NOW() de Neon (UTC).
// Sin esto, pg las lee como hora local del servidor: en un PC en Chile salían
// 3 h adelantadas. 1114 = TIMESTAMP WITHOUT TIME ZONE.
types.setTypeParser(1114, (s) => new Date(s.replace(' ', 'T') + 'Z'));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Función de prueba explícita
const testConnection = async () => {
    try {
        await pool.query('SELECT NOW()');
        console.log('☁️ 🔗 Conectado exitosamente a PostgreSQL en Neon');
    } catch (err) {
        console.error('❌ Error fatal de conexión:', err.message);
    }
};

testConnection();

module.exports = pool;