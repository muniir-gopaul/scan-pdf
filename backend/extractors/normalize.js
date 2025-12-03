const synonyms = require("./synonyms.json");

function normalizeRow(raw) {
  const normalized = {
    Barcode: "",
    ItemCode: "",
    Description: "",
    Qty: 0,
    StockQty: 0,
    UnitPrice: 0,
    POPrice: 0,
    NotPostToSAP: false,
  };

  let qtyRaw =
    raw.Qty ||
    raw.qty ||
    raw.QTY ||
    finder("Qty") ||
    raw["Quantity"] ||
    raw["quantity"] ||
    "";
  // Lowercase key map
  const lower = {};
  for (const k in raw) lower[k.toLowerCase()] = raw[k];

  const finder = (target) => {
    const syns = synonyms[target].map((s) => s.toLowerCase());
    for (const key in lower) {
      if (syns.includes(key)) return lower[key];
    }
    return "";
  };

  normalized.Barcode = finder("Barcode");
  normalized.ItemCode = finder("ItemCode");
  normalized.Description = finder("Description");
  normalized.Qty = parseFloat(qtyRaw.toString().replace(/[^\d.]/g, "")) || 0;
  normalized.StockQty =
    parseFloat((finder("StockQty") || "").replace(/[^\d.]/g, "")) || 0;
  normalized.UnitPrice =
    parseFloat(
      (finder("PU_HT") || finder("UnitPrice") || "").replace(/[^\d.]/g, "")
    ) || 0;

  normalized.POPrice =
    parseFloat((finder("POPrice") || "").replace(/[^\d.]/g, "")) || 0;

  normalized.NotPostToSAP = normalized.StockQty < normalized.Qty;
  // console.log("NORMALIZE INPUT:", raw);
  // console.log("NORMALIZED:", normalized);
  return normalized;
}

module.exports = { normalizeRow };
