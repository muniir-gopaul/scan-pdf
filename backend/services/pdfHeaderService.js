const { sql, getPool } = require("../api/db");

/* ---------------------------------------
   SAFE DATE NORMALIZER → Always returns JS Date or null
---------------------------------------- */
function fixDate(input) {
  if (!input) return null;

  let dateStr = input.trim();

  // Case 1: Already valid ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Case 2: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  let match = dateStr.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  if (match) {
    const [_, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
  }

  // Case 3: YYYY/MM/DD or YYYY.MM.DD or YYYY-MM-DD
  match = dateStr.match(/^(\d{4})[./-](\d{2})[./-](\d{2})$/);
  if (match) {
    const [_, yyyy, mm, dd] = match;
    return `${yyyy}-${mm}-${dd}`;
  }

  // Fallback: JS parser attempt
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

/* ---------------------------------------
   SAVE PDF HEADER
---------------------------------------- */
async function savePdfHeader(header) {
  // 🔑 ALWAYS resolve the pool first
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    /* ---------------------------------------
       1. GENERATE NEW DocEntry
    ---------------------------------------- */
    const docEntryReq = new sql.Request(transaction);
    const docEntryResult = await docEntryReq.query(`
      UPDATE ScanPDF.dbo.NumCounter
      SET NextNumber = NextNumber + 1
      OUTPUT INSERTED.NextNumber AS DocEntry
      WHERE [Table] = 'PDFHeader';
    `);

    if (!docEntryResult.recordset.length) {
      throw new Error("NumCounter entry for PDFHeader not found");
    }

    const docEntry = docEntryResult.recordset[0].DocEntry;

    /* ---------------------------------------
       2. INSERT INTO PDFHeader
    ---------------------------------------- */
    const insertReq = new sql.Request(transaction);

    await insertReq
      .input("DocEntry", sql.Int, docEntry)
      .input("CustCode", sql.VarChar(30), header.CustomerCode)
      .input("CustName", sql.VarChar(200), header.CustomerName)
      .input("DocNum", sql.Int, parseInt(header.PONumber))
      .input("OrderDate", sql.DateTime, fixDate(header.OrderDate))
      .input("DeliveryDate", sql.DateTime, fixDate(header.DeliveryDate))
      .input("PostingDate", sql.DateTime, fixDate(header.PostingDate))
      .input("DatePosted", sql.DateTime, new Date())
      .input("PostedBy", sql.VarChar(100), header.PostedBy).query(`
        INSERT INTO ScanPDF.dbo.PDFHeader
        (DocEntry, CustCode, CustName, DocNum, OrderDate, DeliveryDate, PostingDate, DatePosted, PostedBy)
        VALUES
        (@DocEntry, @CustCode, @CustName, @DocNum, @OrderDate, @DeliveryDate, @PostingDate, @DatePosted, @PostedBy);
      `);

    await transaction.commit();

    return {
      success: true,
      docEntry,
      docNum: header.PONumber,
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

module.exports = { savePdfHeader };
