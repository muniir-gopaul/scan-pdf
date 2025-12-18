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
    SELECT 
      LTRIM(RTRIM(CodeBars)) AS Barcode,
      ItemCode,
      ItemName,
      AvailForSale,
      Active
    FROM VW_WA_ItemList
    WHERE LTRIM(RTRIM(CodeBars)) = @barcode
  `;

  try {
    const request = pool.request();
    request.input("barcode", sql.VarChar, barcode);

    // ✅ EXECUTE QUERY
    const result = await request.query(query);

    console.log(`🔍 SAP Lookup for Barcode: ${barcode}`);
    console.log(`📦 Rows found: ${result.recordset.length}`);

    result.recordset.forEach((row, index) => {
      console.log(`➡️ Row ${index + 1}:`, {
        Barcode: row.Barcode,
        ItemCode: row.ItemCode,
        ItemName: row.ItemName,
        AvailForSale: row.AvailForSale,
        Active: row.Active,
      });
    });

    return result.recordset[0] || null;
  } catch (err) {
    console.error("❌ SAP Lookup Error:", err); // log full error
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

    const enriched = { ...row };

    /* ------------------------------
        FILL ERP DATA IF FOUND
    ------------------------------ */
    if (dbItem) {
      enriched.ItemCode = dbItem.ItemCode;
      enriched.Description = dbItem.ItemName;
      enriched.DBDescription = dbItem.ItemName;
      enriched.StockQty = dbItem.AvailForSale ?? 0;
      enriched.Barcode = cleanedBarcode;
      enriched.SAPBarcode = dbItem.Barcode;

      // ✅ NEW
      enriched.SAPActive = dbItem.Active === "Y";
      enriched.DBMatch = true;
    } else {
      enriched.DBMatch = false;
      enriched.DBDescription = "";
      enriched.StockQty = 0;
      enriched.ItemCode = "";
      enriched.Barcode = cleanedBarcode;

      // ✅ NEW
      enriched.SAPActive = false;
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

    enriched.CanPostToSAP =
      enriched.SAPActive === true && enriched.NotPostToSAP === false;

    final.push(enriched);
  }

  return final;
}

module.exports = enrichMappedRows;
