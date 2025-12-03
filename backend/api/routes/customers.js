const express = require("express");
const router = express.Router();
const { pool, poolConnect, sql } = require("../db");

/* ✅ GET: CUSTOMER CODE LIST */
router.get("/codes", async (req, res) => {
  try {
    await poolConnect;

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
    console.error("MSSQL ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ✅ GET: CUSTOMER NAME BY CODE */
router.get("/:code", async (req, res) => {
  try {
    const { code } = req.params;
    await poolConnect;

    const result = await pool.request().input("code", sql.VarChar, code).query(`
        SELECT CardName
        FROM dbo.VW_WA_CustList
        WHERE CardCode = @code
      `);

    res.json({
      success: true,
      row: result.recordset[0],
    });
  } catch (err) {
    console.error("MSSQL ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
