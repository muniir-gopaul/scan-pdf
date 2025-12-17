// backend/extractors/winners.js
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

/* ------------------------------------------------------
   0. Java check
------------------------------------------------------ */
function checkJava() {
  try {
    require("child_process").execSync("java -version", {
      encoding: "utf8",
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------
   Run Tabula (stream mode)
------------------------------------------------------ */
function runTabula(pdfPath, jarPath) {
  return new Promise((resolve, reject) => {
    const cmd = `java -jar "${jarPath}" --stream -p all -f JSON "${pdfPath}"`;

    exec(cmd, { maxBuffer: 1024 * 1024 * 40 }, (err, stdout) => {
      if (err) return reject(err);
      if (!stdout) return reject(new Error("Tabula returned no output"));

      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error("Failed to parse Tabula JSON: " + e.message));
      }
    });
  });
}

/* ------------------------------------------------------
   Helpers
------------------------------------------------------ */
function sanitizeCell(v) {
  if (!v && v !== 0) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function isArticleNo(v) {
  return /^[0-9]{4,7}$/.test(String(v || "").replace(/\D/g, ""));
}

function extractEAN(text) {
  const m = String(text).match(/\b([0-9]{8,14})\b/);
  return m ? m[1] : "";
}

function extractQty(v) {
  const m = String(v).match(/([0-9]+)/);
  return m ? m[1] : "";
}

function isPrice(v) {
  return /^[0-9]+([.,][0-9]+)?$/.test(v);
}

function isFooterRow(row) {
  const s = row.join(" ").toLowerCase();
  return (
    s.includes("nb de lignes") ||
    s.includes("nb colis") ||
    s.includes("montant achat") ||
    s.includes("poids brut") ||
    s.includes("volume")
  );
}

/* ------------------------------------------------------
   Flatten Tabula pages
------------------------------------------------------ */
function flattenTabula(parsed) {
  const flat = [];
  (parsed || []).forEach((page) => {
    (page.data || []).forEach((row) => {
      const cells = row.map((c) => (c && c.text ? sanitizeCell(c.text) : ""));
      while (cells.length && cells[cells.length - 1] === "") cells.pop();
      flat.push(cells);
    });
  });
  return flat;
}

/* ------------------------------------------------------
   Merge continuation rows (stop at footer)
------------------------------------------------------ */
function mergeContinuations(flatRows) {
  const merged = [];

  for (const rowRaw of flatRows) {
    if (isFooterRow(rowRaw)) break;

    const row = rowRaw.map(sanitizeCell);
    const col0 = row[0];
    const col1 = row[1];

    const isNew = isArticleNo(col0) && extractEAN(col1);

    if (isNew) {
      merged.push(row.slice());
      continue;
    }

    if (merged.length) {
      const prev = merged[merged.length - 1];
      for (let i = 2; i < row.length; i++) {
        if (row[i] && !prev[i]) prev[i] = row[i];
      }
    }
  }

  return merged;
}

/* ------------------------------------------------------
   PARSE WINNERS ROWS → DREAMPRICE-STYLE OUTPUT
------------------------------------------------------ */
function parseWinnersRows(mergedRows) {
  const rows = [];

  for (const r of mergedRows) {
    const cells = r.map(sanitizeCell).filter(Boolean);
    if (!isArticleNo(cells[0])) continue;

    const joined = cells.join(" ");
    const Barcode = extractEAN(joined);
    if (!Barcode) continue;

    const eanIndex = cells.findIndex((c) => c.includes(Barcode));
    const tail = cells.slice(eanIndex + 1);

    let DescriptionParts = [];
    let NbColis = "";
    let PCB = "";
    let Qty = "";
    let Total_HT = "";

    let foundVAT = false;

    // RIGHT → LEFT parsing
    for (let i = tail.length - 1; i >= 0; i--) {
      const v = tail[i];

      if (isPrice(v) && !foundVAT) {
        foundVAT = true; // skip VAT
        continue;
      }

      if (isPrice(v) && !Total_HT) {
        Total_HT = v;
        continue;
      }

      if (!Qty && /[0-9]+[A-Za-z]+/.test(v)) {
        Qty = extractQty(v);
        continue;
      }

      if (!PCB && /^[0-9]+$/.test(v)) {
        PCB = v;
        continue;
      }

      if (!NbColis && /^[0-9]+$/.test(v)) {
        NbColis = v;
        continue;
      }

      DescriptionParts.unshift(v);
    }

    rows.push({
      Barcode,
      Description: sanitizeCell(DescriptionParts.join(" ")),
      NbColis,
      PCB,
      Qty,
      Total_HT,
    });
  }

  return rows;
}

/* ------------------------------------------------------
   Save outputs
------------------------------------------------------ */
async function saveOutputs(rows, header, outDir) {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const ts = Date.now();
  const jsonPath = path.join(outDir, `winners_${ts}.json`);
  const xlsxPath = path.join(outDir, `winners_${ts}.xlsx`);

  fs.writeFileSync(jsonPath, JSON.stringify({ header, rows }, null, 2));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Parsed");

  sheet.addRow(["CustomerName", header.CustomerName || ""]);
  sheet.addRow(["PONumber", header.PONumber || ""]);
  sheet.addRow(["OrderDate", header.OrderDate || ""]);
  sheet.addRow(["DeliveryDate", header.DeliveryDate || ""]);
  sheet.addRow([]);

  const headers = [
    "Barcode",
    "Description",
    "NbColis",
    "PCB",
    "Qty",
    "Total_HT",
  ];
  sheet.addRow(headers);

  rows.forEach((r) => sheet.addRow(headers.map((k) => r[k] || "")));

  await workbook.xlsx.writeFile(xlsxPath);
  return { jsonPath, xlsxPath };
}

/* ------------------------------------------------------
   Header extractor (UNCHANGED)
------------------------------------------------------ */
function extractHeaderFromFlat(flatRows) {
  const big = flatRows.map((r) => r.join(" ")).join(" ");
  const header = {
    Branch:
      big.match(
        /^([A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜÇ]{3,})\s+[0-9]{2}\/[0-9]{2}\/[0-9]{4}/m
      )?.[1] || "",
    PONumber:
      big.match(/N[°º]?\s*commande\s*[:\s]*([0-9]+)/i)?.[1] ||
      big.match(/Bon\s+de\s+commande.*?([0-9]{4,})/i)?.[1] ||
      "",
    OrderDate:
      big.match(
        /Date\s+de\s+commande\s*[:\s]*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i
      )?.[1] ||
      big.match(/Date\s+([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i)?.[1] ||
      "",
    DeliveryDate:
      big.match(
        /Date\s+de\s+livraison(?:\s+impérative)?\s*[:\s]*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i
      )?.[1] || "",
    CustomerName:
      big.match(/[0-9]+\s+([A-Za-z0-9 .,'&-]+LTD)/i)?.[1] ||
      big.match(/Fournisseur\s+([A-Za-z0-9 .,'&-]+)/i)?.[1] ||
      "",
    CustomerCode: big.match(/C[0-9]{6,}/)?.[0] || "",
    CustomerEmail:
      big.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] || "",
  };

  Object.keys(header).forEach((k) => {
    header[k] = header[k] ? header[k].trim() : "";
  });

  return header;
}

/* ------------------------------------------------------
   MAIN extractor
------------------------------------------------------ */
async function extractWinners(pdfPath, opts = {}) {
  const jarPath = path.join(__dirname, "..", "tabula", "tabula.jar");

  if (!checkJava()) throw new Error("Java is not installed or not in PATH.");
  if (!fs.existsSync(jarPath))
    throw new Error(`Tabula JAR not found at: ${jarPath}`);

  const parsed = await runTabula(pdfPath, jarPath);
  const flat = flattenTabula(parsed);
  const merged = mergeContinuations(flat);
  const header = extractHeaderFromFlat(flat);
  const rows = parseWinnersRows(merged);

  const outDir = opts.saveTo || path.join(__dirname, "..", "output");
  const { jsonPath, xlsxPath } = await saveOutputs(rows, header, outDir);

  const columns = [
    { name: "Barcode", label: "Barcode", field: "Barcode" },
    { name: "Description", label: "Description", field: "Description" },
    { name: "NbColis", label: "Nb Colis", field: "NbColis" },
    { name: "PCB", label: "PCB", field: "PCB" },
    { name: "Qty", label: "Qty", field: "Qty" },
    { name: "Total_HT", label: "Total (HT)", field: "Total_HT" },
  ];

  return { header, columns, rows, jsonPath, xlsxPath };
}

module.exports = { extractWinners };
