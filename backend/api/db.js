require("dotenv").config();
const sql = require("mssql");

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_HOST,
  port: Number(process.env.DB_PORT), // ✅ must be NUMBER
  database: process.env.DB_NAME,
  options: {
    encrypt: false, // ✅ REQUIRED for local SQL Server
    trustServerCertificate: true, // ✅ REQUIRED to avoid cert issues
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 15000,
  requestTimeout: 15000,
};
console.log("DB CONFIG CHECK", {
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
});
const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

poolConnect
  .then(() => {
    console.log("✅ MSSQL Connected via TCP on 1433");
  })
  .catch((err) => {
    console.error("❌ MSSQL Connection Failed:", err.message);
  });

module.exports = { sql, pool, poolConnect };
