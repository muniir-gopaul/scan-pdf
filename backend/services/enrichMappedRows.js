// backend/services/enrichMappedRows.js

const { sql, getPool } = require("../api/db");

/* ---------------------------------------
   CLEAN BARCODE (remove leading zeros)
---------------------------------------- */
function cleanBarcode(bc) {
  if (!bc) return "";
  return bc.toString().trim().replace(/^0+/, "");
}

/* ---------------------------------------
   ITEM LOOKUP BY BARCODE
---------------------------------------- */
async function lookupItemByBarcode(barcode) {
  if (!barcode) return null;

  // 🔑 OPTION A: force numeric barcode
  const barcodeNum = Number(barcode);
  console.log("🔍 Lookup barcode:", barcode, "as number:", barcodeNum);

  if (!Number.isSafeInteger(barcodeNum)) {
    console.warn("⚠️ Invalid barcode (not numeric):", barcode);
    return null;
  }

  const query = `
    SELECT 
      CodeBars AS Barcode,
      ItemCode,
      ItemName,
      AvailForSale,
      Active
    FROM VW_WA_ItemList
    WHERE TRY_CONVERT(BIGINT, CodeBars) = @barcode
  `;

  try {
    const pool = await getPool(); // ✅ REQUIRED
    const request = pool.request(); // ✅ CORRECT OBJECT

    request.input("barcode", sql.BigInt, barcodeNum);

    const result = await request.query(query);
    return result.recordset[0] || null;
  } catch (err) {
    console.error("❌ SAP Lookup Error:", err);
    return null;
  }
}

/* ---------------------------------------
   PRICELIST CHECK (VIEW ONLY)
---------------------------------------- */
async function lookupPricelistPrice(itemCode, pricelist) {
  if (!itemCode || !Number.isInteger(pricelist) || pricelist <= 0) {
    return null;
  }

  const query = `
    SELECT 
      ItemCode,
      Price
    FROM VW_WA_Pricelist
    WHERE ItemCode = @itemCode
      AND Pricelist = @pricelist
      AND Price IS NOT NULL
      AND Price > 0
  `;

  try {
    const pool = await getPool();
    const request = pool.request();
    request.input("itemCode", sql.VarChar, itemCode);
    request.input("pricelist", sql.Int, pricelist);

    const result = await request.query(query);
    return result.recordset[0] || null;
  } catch (err) {
    console.error("❌ VW_WA_Pricelist Lookup Error:", err);
    return null;
  }
}

/* ---------------------------------------
   UI NORMALIZER (CONTRACT)
---------------------------------------- */
function normalizeUiRow(row) {
  return {
    Barcode: row.Barcode || "",
    ItemCode: row.ItemCode || "",
    Description: row.Description || "",
    DBDescription: row.DBDescription || "",

    Qty: Number(row.Qty ?? 0),
    StockQty: Number(row.StockQty ?? 0),
    PostQty: Number(row.PostQty ?? 0),

    Price: row.Price ?? null,
    PricelistStatus: row.PricelistStatus || "UNKNOWN",

    SAPActive: row.SAPActive === true,
    NotPostToSAP: row.NotPostToSAP === null ? null : Boolean(row.NotPostToSAP),
    CanPostToSAP: row.CanPostToSAP === true,
    SAPStatus: row.SAPStatus || "NOT_FOUND",

    SAPBarcode: row.SAPBarcode || "",
    DBMatch: Boolean(row.DBMatch),
  };
}

/* ---------------------------------------
   ENRICH PDF ROWS (FINAL FLOW)
---------------------------------------- */
async function enrichMappedRows(mappedRows, rawPricelist) {
  const final = [];

  const pricelist = Number(rawPricelist);
  const hasValidPricelist = Number.isInteger(pricelist) && pricelist > 0;

  for (const rawRow of mappedRows) {
    const cleanedBarcode = cleanBarcode(rawRow.Barcode);
    const dbItem = await lookupItemByBarcode(cleanedBarcode);

    const enriched = {
      ...rawRow,

      Barcode: cleanedBarcode,

      ItemCode: "",
      Description: "",
      DBDescription: "",
      PDFDescription: rawRow.Description || "",

      StockQty: 0,
      Price: null,
      PricelistStatus: "UNKNOWN",

      SAPActive: null,
      SAPStatus: "NOT_FOUND",
      NotPostToSAP: null,
      CanPostToSAP: false,
      DBMatch: false,
    };

    if (!dbItem) {
      // ❌ Item does not exist in SAP
      enriched.SAPStatus = "NOT_FOUND";
      enriched.SAPActive = null;
      enriched.PricelistStatus = "ITEM_NOT_FOUND";
    } else {
      // ✅ Item exists
      enriched.ItemCode = dbItem.ItemCode;
      enriched.Description = dbItem.ItemName;
      enriched.DBDescription = dbItem.ItemName;
      enriched.StockQty = Number(dbItem.AvailForSale ?? 0);
      enriched.SAPBarcode = dbItem.Barcode;
      enriched.DBMatch = true;

      if (dbItem.Active === "Y") {
        enriched.SAPActive = true;
        enriched.SAPStatus = "ACTIVE";
      } else {
        enriched.SAPActive = false;
        enriched.SAPStatus = "INACTIVE";
      }
    }

    /* PRICELIST VALIDATION */
    if (enriched.ItemCode && hasValidPricelist) {
      const priceRow = await lookupPricelistPrice(enriched.ItemCode, pricelist);

      if (priceRow) {
        enriched.Price = Number(priceRow.Price);
        enriched.PricelistStatus = "PRICELIST_EXISTS";
      } else {
        enriched.PricelistStatus = "NO_PRICELIST";
      }
    } else if (enriched.ItemCode && !hasValidPricelist) {
      enriched.PricelistStatus = "NO_PRICELIST";
    }

    /* STOCK & BUSINESS RULES */
    const qty = Number(enriched.Qty ?? 0);
    const stock = Number(enriched.StockQty ?? 0);

    if (enriched.SAPStatus === "ACTIVE") {
      enriched.NotPostToSAP =
        stock <= 0 || enriched.PricelistStatus !== "PRICELIST_EXISTS";
    } else {
      enriched.NotPostToSAP = null;
    }

    enriched.PostQty = stock > 0 ? Math.min(qty, stock) : 0;

    /* FINAL POSTING GATE */
    enriched.CanPostToSAP =
      enriched.SAPStatus === "ACTIVE" &&
      enriched.NotPostToSAP === false &&
      enriched.PostQty > 0 &&
      enriched.PricelistStatus === "PRICELIST_EXISTS";

    final.push(normalizeUiRow(enriched));
  }

  return final;
}

module.exports = enrichMappedRows;
