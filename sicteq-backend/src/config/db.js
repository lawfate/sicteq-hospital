const { Pool } = require('pg');
require('dotenv').config();

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