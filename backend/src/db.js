const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,          // true si tu SQL Server exige conexión cifrada (Azure, por ejemplo)
    trustServerCertificate: true, // válido para desarrollo local
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Pool de conexiones: se crea una sola vez y se reutiliza en toda la app.
// Nunca abras una conexión nueva por cada petición: es lento y agota recursos.
let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then((pool) => {
        console.log('Conectado a SQL Server correctamente');
        return pool;
      })
      .catch((err) => {
        console.error('Error al conectar con SQL Server:', err.message);
        poolPromise = null; // permite reintentar en la siguiente petición
        throw err;
      });
  }
  return poolPromise;
}

module.exports = { sql, getPool };
