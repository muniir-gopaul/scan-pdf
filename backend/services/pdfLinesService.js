const { sql, getPool } = require("../api/db");

async function savePdfLines(docEntry, lines) {
  // 🔑 ALWAYS resolve the pool first
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    let lineNum = 1;

    for (const row of lines) {
      const req = new sql.Request(transaction);

      const qty = Number(row.Quantity ?? 0);

      // ✅ SINGLE SOURCE OF TRUTH
      const canPostToSAP = row.CanPostToSAP === true;

      const postToSAP = canPostToSAP ? 0 : 1;
      const isActive = row.SAPStatus === "ACTIVE" ? 1 : 0;
      const hasPricelist = row.PricelistStatus === "PRICELIST_EXISTS" ? 1 : 0;

      // 🔍 DEBUG TRACE (TEMP — REMOVE LATER)
      console.log("💾 SQL LINE", {
        ItemCode: row.ItemCode,
        SAPActive: row.SAPActive,
        PricelistStatus: row.PricelistStatus,
        CanPostToSAP: row.CanPostToSAP,
        PostToSAP: postToSAP,
        Active: isActive,
        Pricelist: hasPricelist,
      });

      await req
        .input("DocEntry", sql.Int, docEntry)
        .input("LineNum", sql.Int, lineNum++)
        .input("ItemCode", sql.VarChar(50), row.ItemCode || "")
        .input("Description", sql.VarChar(300), row.Description || "")
        .input("Barcode", sql.VarChar(50), row.Barcode || "")
        .input("Quantity", sql.Decimal(18, 2), qty)
        .input("UnitPrice", sql.Decimal(18, 2), 0)
        .input("StockQty", sql.Decimal(18, 2), row.StockQty || 0)
        .input("POPrice", sql.Decimal(18, 2), row.POPrice || 0)
        .input("PostToSAP", sql.Bit, postToSAP)
        .input("Active", sql.Bit, isActive)
        .input("Pricelist", sql.Bit, hasPricelist).query(`
          INSERT INTO ScanPDF.dbo.PDFLines
          (
            DocEntry,
            LineNum,
            ItemCode,
            Description,
            Barcode,
            Quantity,
            UnitPrice,
            StockQty,
            POPrice,
            PostToSAP,
            Active,
            Pricelist
          )
          VALUES
          (
            @DocEntry,
            @LineNum,
            @ItemCode,
            @Description,
            @Barcode,
            @Quantity,
            @UnitPrice,
            @StockQty,
            @POPrice,
            @PostToSAP,
            @Active,
            @Pricelist
          )
        `);
    }

    await transaction.commit();
    return { success: true };
  } catch (err) {
    await transaction.rollback();
    console.error("❌ savePdfLines ERROR:", err);
    throw err;
  }
}

module.exports = { savePdfLines };
