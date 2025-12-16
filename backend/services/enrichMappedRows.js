const { sql, pool } = require("../api/db");

/* ---------------------------------------
   CLEAN BARCODE (remove leading zeros)
---------------------------------------- */
function cleanBarcode(bc) {
  if (!bc) return "";
  return bc.toString().trim().replace(/^0+/, "");
}

/* ---------------------------------------
   EXACT SAP DB LOOKUP
---------------------------------------- */
async function lookupItemByBarcode(barcode) {
  if (!barcode) return null;

  const query = `
  SELECT TOP 1
    LTRIM(RTRIM(CodeBars)) AS Barcode,
    ItemCode,
    ItemName,
    AvailForSale
  FROM dbo.VW_WA_ItemList
  WHERE LTRIM(RTRIM(CodeBars)) = @barcode
`;

  try {
    const request = pool.request();
    request.input("barcode", sql.VarChar, barcode);
    console.log(request);
    const result = await request.query(query);
    return result.recordset[0] || null;
  } catch (err) {
    console.error("❌ SAP Lookup Error:", err.message);
    return null;
  }
}

/* ---------------------------------------
   ENRICH PDF ROWS WITH ALL RULES
---------------------------------------- */
async function enrichMappedRows(mappedRows) {
  const final = [];

  for (const row of mappedRows) {
    const cleanedBarcode = cleanBarcode(row.Barcode);
    const dbItem = await lookupItemByBarcode(cleanedBarcode);
    console.log("Lookup for barcode", cleanedBarcode, "found:", dbItem);
    const enriched = { ...row };

    /* ------------------------------
        FILL ERP DATA IF FOUND
    ------------------------------ */
    if (dbItem) {
      enriched.ItemCode = dbItem.ItemCode;
      enriched.Description = dbItem.ItemName;
      enriched.DBDescription = dbItem.ItemName;
      enriched.StockQty = dbItem.AvailForSale ?? 0;

      // SHOW CLEANED BARCODE IN UI AND ERP TABLE
      enriched.Barcode = cleanedBarcode;

      enriched.SAPBarcode = dbItem.Barcode;

      enriched.DBMatch = true;
    } else {
      enriched.DBMatch = false;
      enriched.DBDescription = "";
      enriched.StockQty = 0;
      enriched.ItemCode = "";

      // Show cleaned barcode even when no match
      enriched.Barcode = cleanedBarcode;
    }

    /* ------------------------------
        BUSINESS RULE:
        When to BLOCK (NotPostToSAP = true)
        - Missing ItemCode
        - StockQty <= 0
        - StockQty < Qty
    ------------------------------ */
    const qty = Number(enriched.Qty ?? 0);
    const stock = Number(enriched.StockQty ?? 0);

    enriched.NotPostToSAP =
      !enriched.ItemCode || // missing item
      stock <= 0 || // zero or negative stock
      stock < qty; // insufficient stock

    final.push(enriched);
  }

  return final;
}

module.exports = enrichMappedRows;
