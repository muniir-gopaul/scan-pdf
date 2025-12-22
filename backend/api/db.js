require("dotenv").config();
const sql = require("mssql");

const config = {
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASS,
  server: process.env.DB_HOST, // MUST be a string
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
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
let poolPromise = null;

async function getPool() {
  if (!poolPromise) {
    poolPromise = sql
      .connect(config)
      .then((pool) => {
        console.log("✅ MSSQL pool connected");
        return pool;
      })
      .catch((err) => {
        poolPromise = null;
        console.error("❌ MSSQL connection failed:", err);
        throw err;
      });
  }
  return poolPromise;
}

module.exports = {
  sql,
  getPool,
};
