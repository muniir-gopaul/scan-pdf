const express = require("express");
const router = express.Router();
const { getPool, sql } = require("../db");

/* ✅ GET: CUSTOMER CODE LIST */
router.get("/codes", async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT CardCode, CardName
      FROM dbo.VW_WA_CustList
      ORDER BY CardCode
    `);

    res.json({
      success: true,
      rows: result.recordset,
    });
  } catch (err) {
    console.error("❌ MSSQL ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load customer codes",
    });
  }
});

/* ✅ GET: CUSTOMER NAME BY CODE */
router.get("/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const pool = await getPool();

    const result = await pool.request().input("code", sql.VarChar, code).query(`
        SELECT 
          CardCode,
          CardName,
          ISNULL(Pricelist, 0) AS Pricelist
        FROM dbo.VW_WA_CustList
        WHERE CardCode = @code
      `);

    if (!result.recordset.length) {
      return res.json({
        success: false,
        message: "Customer not found",
      });
    }

    res.json({
      success: true,
      row: result.recordset[0],
    });
  } catch (err) {
    console.error("❌ MSSQL ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load customer",
    });
  }
});

module.exports = router;
