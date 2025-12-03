const { sql, pool } = require("../api/db");

function fixDate(d) {
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;

  const match = d.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/);
  if (match) {
    const [_, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

async function savePdfDocumentAtomic(header, lines) {
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1️⃣ Generate next DocEntry from dbo.NumCounter
    const req1 = new sql.Request(transaction);
    const docEntryResult = await req1.query(`
      UPDATE ScanPDF.dbo.NumCounter
      SET NextNumber = NextNumber + 1
      OUTPUT INSERTED.NextNumber AS DocEntry
      WHERE [Table] = 'PDFHeader';
    `);

    if (!docEntryResult.recordset.length) {
      throw new Error("NumCounter row for 'PDFHeader' not found");
    }

    const docEntry = docEntryResult.recordset[0].DocEntry;

    // 2️⃣ Insert into PDFHeader
    const req2 = new sql.Request(transaction);
    await req2
      .input("CustCode", sql.NVarChar, header.CustomerCode)
      .input("CustName", sql.NVarChar, header.CustomerName)
      .input("DocNum", sql.NVarChar, header.PONumber) // PO Number → DocNum
      .input("DocEntry", sql.Int, docEntry)
      .input("OrderDate", sql.DateTime, fixDate(header.OrderDate))
      .input("DeliveryDate", sql.DateTime, fixDate(header.DeliveryDate))
      .input("PostingDate", sql.DateTime, fixDate(header.PostingDate))
      .input("DatePosted", sql.DateTime, new Date())
      .input("PostedBy", sql.NVarChar, header.PostedBy).query(`
        INSERT INTO ScanPDF.dbo.PDFHeader
        (CustCode, CustName, DocNum, DocEntry, OrderDate, DeliveryDate, PostingDate, DatePosted, PostedBy)
        VALUES
        (@CustCode, @CustName, @DocNum, @DocEntry, @OrderDate, @DeliveryDate, @PostingDate, @DatePosted, @PostedBy)
      `);

    // 3️⃣ Insert lines
    const req3 = new sql.Request(transaction);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      await req3
        .input("DocEntry", sql.Int, docEntry)
        .input("LineNum", sql.Int, i + 1) // auto incremental per line
        .input("ItemCode", sql.NVarChar, line.ItemCode || "")
        .input("Description", sql.NVarChar, line.Description || "")
        .input("Barcode", sql.NVarChar, line.Barcode || "")
        .input("Quantity", sql.Int, line.Qty || 0) // <- correct quantity
        .input("UnitPrice", sql.Decimal(18, 2), line.UnitPrice || 0)
        .input("POPrice", sql.Decimal(18, 2), line.UnitPrice || 0) // PU_HT → POPrice
        .query(`
          INSERT INTO ScanPDF.dbo.PDFLines
          (DocEntry, LineNum, ItemCode, Description, Barcode, Quantity, UnitPrice, POPrice)
          VALUES
          (@DocEntry, @LineNum, @ItemCode, @Description, @Barcode, @Quantity, @UnitPrice, @POPrice)
        `);
    }

    await transaction.commit();

    return { success: true, docEntry };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

module.exports = { savePdfDocumentAtomic };
