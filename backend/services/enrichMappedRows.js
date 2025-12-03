const { sql, pool } = require("../api/db");

/* ---------------------------------------
   CLEAN BARCODE (remove leading zeros)
---------------------------------------- */
function cleanBarcode(bc) {
  if (!bc) return "";
  return bc.toString().trim().replace(/^0+/, ""); // ← ONLY REMOVE LEADING 0
}

/* ---------------------------------------
   EXACT SAP DB LOOKUP (no variations)
---------------------------------------- */
async function lookupItemByBarcode(barcode) {
  if (!barcode) return null;

  const query = `
    SELECT 
      LTRIM(RTRIM(CodeBars)) AS Barcode,
      ItemCode,
      ItemName,
      AvailForSale
    FROM VW_WA_ItemList
    WHERE LTRIM(RTRIM(CodeBars)) = @barcode
  `;

  try {
    const request = pool.request();
    request.input("barcode", sql.VarChar, barcode);

    const result = await request.query(query);

    return result.recordset[0] || null;
  } catch (err) {
    console.error("❌ SAP Lookup Error:", err.message);
    return null;
  }
}

/* ---------------------------------------
   ENRICH PDF ROWS
---------------------------------------- */
async function enrichMappedRows(mappedRows) {
  const final = [];

  for (const row of mappedRows) {
    const cleanedBarcode = cleanBarcode(row.Barcode);

    const dbItem = await lookupItemByBarcode(cleanedBarcode);

    const enriched = { ...row };
    console.log("enriched:", enriched);
    console.log("dbItem:", dbItem);
    console.log("cleanedBarcode:", cleanedBarcode);

    if (dbItem) {
      enriched.ItemCode = dbItem.ItemCode;
      enriched.Description = dbItem.ItemName;
      enriched.DBDescription = dbItem.ItemName;
      enriched.StockQty = dbItem.AvailForSale ?? 0;
      enriched.Barcode = dbItem.Barcode;
      enriched.DBMatch = true;
    } else {
      enriched.DBMatch = false;
      enriched.DBDescription = "";
      enriched.StockQty = 0;
      enriched.ItemCode = "";
    }

    enriched.NotPostToSAP = Number(enriched.StockQty) < Number(enriched.Qty);

    final.push(enriched);
  }

  return final;
}

module.exports = enrichMappedRows;
