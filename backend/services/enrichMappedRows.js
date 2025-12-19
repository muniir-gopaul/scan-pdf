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
    const result = await request.query(query);
    return result.recordset[0] || null;
  } catch (err) {
    console.error("❌ SAP Lookup Error:", err);
    return null;
  }
}

/* ---------------------------------------
   STRICT ROW NORMALIZER (UI CONTRACT)
---------------------------------------- */
function normalizeUiRow(row) {
  return {
    // 🔒 IDENTIFIERS
    Barcode: row.Barcode || "",
    ItemCode: row.ItemCode || "",
    Description: row.Description || "",
    DBDescription: row.DBDescription || "",

    // 🔒 NUMBERS
    Qty: Number(row.Qty ?? 0),
    StockQty: Number(row.StockQty ?? 0),

    // 🔒 UI STATUS FLAGS (3-STATE SAFE)
    SAPActive: row.SAPActive === true,
    NotPostToSAP: row.NotPostToSAP === null ? null : Boolean(row.NotPostToSAP),
    CanPostToSAP: row.CanPostToSAP === true,

    // 🔒 OPTIONAL / META
    SAPBarcode: row.SAPBarcode || "",
    DBMatch: Boolean(row.DBMatch),
  };
}

/* ---------------------------------------
   ENRICH PDF ROWS WITH ALL RULES
---------------------------------------- */
async function enrichMappedRows(mappedRows) {
  const final = [];

  for (const rawRow of mappedRows) {
    const cleanedBarcode = cleanBarcode(rawRow.Barcode);
    const dbItem = await lookupItemByBarcode(cleanedBarcode);

    // ---- BASE ROW
    const enriched = {
      ...rawRow,

      Barcode: cleanedBarcode,

      // ERP FIELDS
      ItemCode: "",
      Description: "",
      DBDescription: "",
      PDFDescription: rawRow.Description || "",

      StockQty: 0,

      // ✅ STATE FLAGS (SAFE DEFAULTS)
      SAPActive: false,
      NotPostToSAP: null, // ⬅️ IMPORTANT
      CanPostToSAP: false,
      DBMatch: false,
    };

    /* ------------------------------
       ERP RESOLUTION (SOURCE OF TRUTH)
    ------------------------------ */
    if (dbItem) {
      enriched.ItemCode = dbItem.ItemCode;
      enriched.Description = dbItem.ItemName;
      enriched.DBDescription = dbItem.ItemName;
      enriched.StockQty = Number(dbItem.AvailForSale ?? 0);
      enriched.SAPBarcode = dbItem.Barcode;
      enriched.SAPActive = dbItem.Active === "Y";
      enriched.DBMatch = true;
    }

    /* ------------------------------
       BUSINESS RULES (STOCK ONLY)
    ------------------------------ */
    if (enriched.SAPActive) {
      const qty = Number(enriched.Qty ?? 0);
      const stock = Number(enriched.StockQty ?? 0);

      enriched.NotPostToSAP = stock <= 0 || stock < qty;
    }
    const qty = Number(enriched.Qty ?? 0);
    const stock = Number(enriched.StockQty ?? 0);

    enriched.NotPostToSAP =
      stock <= 0 || // no stock
      stock < qty; // insufficient stock

    /* ------------------------------
       FINAL POSTING GATE
    ------------------------------ */
    enriched.CanPostToSAP =
      enriched.SAPActive === true &&
      Boolean(enriched.ItemCode) &&
      enriched.NotPostToSAP === false;
    /* ------------------------------
       NORMALIZE FOR UI
    ------------------------------ */
    final.push(normalizeUiRow(enriched));
  }

  return final;
}

module.exports = enrichMappedRows;
