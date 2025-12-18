// backend/api/routes/extract.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const { extractDreamprice } = require("../../extractors/dreamprice");
const { extractWinners } = require("../../extractors/winners");
const enrichMappedRows = require("../../services/enrichMappedRows");

// Load normalizeRow (ERP format builder)
let normalizeRow = () => ({});
try {
  normalizeRow = require("../../extractors/normalize").normalizeRow;
} catch (e) {
  console.warn("⚠ normalizeRow not loaded, using fallback mapper");
}

router.post("/", upload.single("pdf"), async (req, res) => {
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
     * STEP 2 → Convert raw rows → ERP mapped rows via normalizeRow()
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
     * STEP 3 → SANITIZE HEADER (Do not use CustomerCode and CustomerName from the PDF)
     */
    const sanitizedHeader = {
      ...result.header,
      CustomerCode: "",
      CustomerName: "",
    };

    /*
     * STEP 4 → Enrich with SAP DB (ItemCode, Stock, DBDescription, etc.)
     */
    console.log("🔥 Enriching", normalizedRows.length, "rows...");
    const enrichedRows = await enrichMappedRows(normalizedRows);
    console.log("🔥 ENRICHED FIRST ROW:", enrichedRows[0]);

    /*
     * STEP 5 → Send to UI
     * IMPORTANT:
     *  - mappedRows contains enrichedRows for the table
     *  - enrichedRows is also sent separately for saving
     */
    res.json({
      success: true,

      header: sanitizedHeader,

      rawRows,
      columnsRaw: result.columns,

      mappedRows: enrichedRows,

      enrichedRows: enrichedRows,

      columnsMapped: [
        { name: "Barcode", label: "Barcode", field: "Barcode", align: "left" },
        {
          name: "ItemCode",
          label: "Item Code",
          field: "ItemCode",
          align: "left",
        },
        {
          name: "Description",
          label: "PDF Description",
          field: "Description",
          align: "left",
        },
        { name: "Qty", label: "Qty", field: "Qty", align: "right" },
        {
          name: "StockQty",
          label: "Stock Qty",
          field: "StockQty",
          align: "center",
        },
      ],
    });
  } catch (err) {
    console.error("❌ EXTRACT ERROR:", err);
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
