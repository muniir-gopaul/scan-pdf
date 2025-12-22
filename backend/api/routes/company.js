const express = require("express");
const router = express.Router();
const { getPool } = require("../db");

/**
 * PUBLIC
 * Used by login screen BEFORE authentication
 */
router.get("/company-dbs", async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT
        dbName  AS CompanyDB,
        cmpName AS Company
      FROM [SBO-COMMON].[DBO].[SRGC]
      ORDER BY cmpName
    `);

    res.json({
      success: true,
      rows: result.recordset,
    });
  } catch (err) {
    console.error("❌ SRGC ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Unable to load company list",
    });
  }
});

module.exports = router;
