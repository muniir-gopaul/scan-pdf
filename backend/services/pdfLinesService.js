const { sql, pool } = require("../api/db");

async function savePdfLines(docEntry, lines) {
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    let lineNum = 1;

    for (const row of lines) {
      const req = new sql.Request(transaction);

      delete row.UnitPrice;

      const qty = row.Quantity ?? row.Qty ?? 0;
      const shouldNotPost = row.StockQty < qty; // TRUE if block

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
        .input("PostToSAP", sql.Bit, shouldNotPost ? 1 : 0).query(`
      INSERT INTO ScanPDF.dbo.PDFLines
      (DocEntry, LineNum, ItemCode, Description, Barcode, Quantity, UnitPrice, StockQty, POPrice, PostToSAP)
      VALUES
      (@DocEntry, @LineNum, @ItemCode, @Description, @Barcode, @Quantity, @UnitPrice, @StockQty, @POPrice, @PostToSAP)
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
