// backend/api/routes/extract.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const { extractDreamprice } = require("../../extractors/dreamprice");
const { extractWinners } = require("../../extractors/winners");
const enrichMappedRows = require("../../services/enrichMappedRows");
const requireSapSession = require('../middleware/requireSapSession');

// Load normalizeRow (ERP format builder)
let normalizeRow = () => ({});
try {
  normalizeRow = require("../../extractors/normalize").normalizeRow;
} catch (e) {
  console.warn("⚠ normalizeRow not loaded, using fallback mapper");
}

router.post("/",  requireSapSession, upload.single("pdf"), async (req, res) => {
  try {
    const { template } = req.body;
    const pdfPath = req.file.path;

    console.log("🚀 /api/extract ROUTE TRIGGERED");

    /*
     * STEP 1 → Extract RAW PDF rows
     */
    const result =
      template === "dreamprice"
        ? await extractDreamprice(pdfPath)
        : await extractWinners(pdfPath);

    const rawRows = result.rows;
    console.log("📄 RAW FIRST ROW:", rawRows[0]);

    /*
     * STEP 2 → Convert raw rows → ERP mapped rows
     */
    const normalizedRows = rawRows.map((row) => {
      try {
        return normalizeRow(row);
      } catch (err) {
        console.warn("⚠ normalizeRow failed:", err);
        return {};
      }
    });

    console.log("🧱 NORMALIZED FIRST ROW:", normalizedRows[0]);

    /*
     * STEP 3 → SANITIZE HEADER
     */
    const sanitizedHeader = {
      ...result.header,
    };

    /*
     * STEP 4 → READ & NORMALIZE PRICELIST FROM FRONTEND
     * (FormData always sends strings)
     */
    const rawPricelist = req.body.pricelist;
    const pricelist = Number(rawPricelist) || 0;

    console.log("💰 PRICELIST RECEIVED:", rawPricelist, "→", pricelist);

    /*
     * STEP 5 → Enrich rows (ItemCode, Stock, Pricelist, Rules)
     */
    console.log("🔥 Enriching", normalizedRows.length, "rows...");
    const enrichedRows = await enrichMappedRows(normalizedRows, pricelist);
    console.log("🔥 ENRICHED FIRST ROW:", enrichedRows[0]);

    /*
     * STEP 6 → Send to UI
     */
    res.json({
      success: true,

      header: sanitizedHeader,

      rawRows,
      columnsRaw: result.columns,

      mappedRows: enrichedRows,
      enrichedRows: enrichedRows,
    });
  } catch (err) {
    console.error("❌ EXTRACT ERROR:", err);
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
