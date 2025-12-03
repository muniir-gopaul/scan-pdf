// backend/extractors/winners.js
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

/* ------------------------------------------------------
   0. Java check (same as dreamprice)
------------------------------------------------------ */
function checkJava() {
  try {
    require("child_process").execSync("java -version", {
      encoding: "utf8",
      stdio: "ignore",
    });
    return true;
  } catch (e) {
    return false;
  }
}

/* ------------------------------------------------------
   Run Tabula (stream mode)
------------------------------------------------------ */
function runTabula(pdfPath, jarPath) {
  return new Promise((resolve, reject) => {
    const cmd = `java -jar "${jarPath}" --stream -p all -f JSON "${pdfPath}"`;

    exec(cmd, { maxBuffer: 1024 * 1024 * 40 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      if (!stdout) return reject(new Error("Tabula returned no output"));

      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch (e) {
        reject(new Error("Failed to parse Tabula JSON: " + e.message));
      }
    });
  });
}

/* ------------------------------------------------------
   Helpers: validators
------------------------------------------------------ */
function isArticleNo(v) {
  if (!v) return false;
  return /^[0-9]{4,7}$/.test(v.replace(/\D/g, ""));
}

function isEAN(v) {
  if (!v) return false;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 14;
}

function sanitizeCell(c) {
  if (!c && c !== 0) return "";
  return String(c).replace(/\s+/g, " ").trim();
}

/* ------------------------------------------------------
   Flatten Tabula JSON pages -> rows of plain cell texts
------------------------------------------------------ */
function flattenTabula(parsed) {
  const flat = [];
  (parsed || []).forEach((page) => {
    (page.data || []).forEach((row) => {
      const cells = row.map((c) => (c && c.text ? sanitizeCell(c.text) : ""));
      // remove trailing empty columns
      while (cells.length && cells[cells.length - 1] === "") cells.pop();
      flat.push(cells);
    });
  });
  return flat;
}

/* ------------------------------------------------------
   Merge continuation rows
   - If a row doesn't start with ArticleNo+EAN, treat as continuation
   - Append its content to previous row description
------------------------------------------------------ */
function mergeContinuations(flatRows) {
  const merged = [];

  for (let i = 0; i < flatRows.length; i++) {
    const row = flatRows[i].map((c) => sanitizeCell(c));

    const col0 = row[0];
    const col1 = row[1];

    const looksLikeNewItem = isArticleNo(col0) && isEAN(col1);

    if (looksLikeNewItem) {
      merged.push(row.slice());
      continue;
    }

    // 🔁 CONTINUATION LINE (wrapped description, packaging, etc.)
    if (merged.length > 0) {
      const prev = merged[merged.length - 1];

      // merge all meaningful text into description slot (col index 2)
      const continuationText = row.filter((x) => x && !isEAN(x)).join(" ");

      if (continuationText) {
        while (prev.length < 3) prev.push("");
        prev[2] = sanitizeCell(`${prev[2] || ""} ${continuationText}`);
      }

      // also merge any numeric tail that may appear on continuation row
      for (let k = 3; k < row.length; k++) {
        if (row[k] && !prev[k]) {
          prev[k] = row[k];
        }
      }
    }
  }

  return merged;
}

/* ------------------------------------------------------
   Parse merged rows into structured objects
   Strategy:
   - Expect columns: [ArticleNo, EAN, Description, NbColis, PCB, Qty, Price, Promo ...]
   - Because Tabula sometimes collapses last columns, we take 'tail' approach:
     - article = cell[0]
     - ean = cell[1]
     - tail = cells.slice(2)
     - if tail.length >= 6 => last 6 map to [NbColis,PCB,Qty,Price,Promo,Tax?]
     - if tail.length >= 5 => last 5 map to [NbColis,PCB,Qty,Price,Promo]
     - if tail.length == 4 => [NbColis,PCB,Qty,Price]
     - else fallback: try to parse numbers at end of description string
------------------------------------------------------ */
function parseMergedRows(mergedRows) {
  const rows = [];

  for (const r of mergedRows) {
    const cells = r.map((c) => sanitizeCell(c));

    const article = sanitizeCell(cells[0] || "");
    const ean = sanitizeCell(cells[1] || "");

    if (!isArticleNo(article) || !isEAN(ean)) continue;

    const tail = cells.slice(2).filter(Boolean);

    let Description = "";
    let NbColis = "";
    let PCB = "";
    let Qty = "";
    let Price = "";
    let Promo = "";
    let Tax = "";

    // ✅ SMART RIGHT-ALIGN MAPPING
    const numeric = tail.filter((v) => /^[0-9.,]+$/.test(v));

    if (numeric.length >= 4) {
      Price = numeric[numeric.length - 2];
      Qty = numeric[numeric.length - 3];
      PCB = numeric[numeric.length - 4];
      NbColis = numeric[numeric.length - 5] || "";
    } else if (numeric.length >= 3) {
      Price = numeric[numeric.length - 1];
      Qty = numeric[numeric.length - 2];
      PCB = numeric[numeric.length - 3];
    }

    // ✅ DESCRIPTION = EVERYTHING ELSE
    Description = tail
      .filter((v) => !numeric.includes(v))
      .join(" ")
      .trim();

    // ✅ FINAL CLEAN
    Description = sanitizeCell(Description);
    NbColis = sanitizeCell(NbColis);
    PCB = sanitizeCell(PCB);
    Qty = sanitizeCell(Qty);
    Price = sanitizeCell(Price);
    Promo = sanitizeCell(Promo);
    Tax = sanitizeCell(Tax);

    rows.push({
      ArticleNo: article,
      EAN: ean,
      Description,
      NbColis,
      PCB,
      Qty,
      Price,
      Promo,
      Tax,
    });
  }

  return rows;
}

/* ------------------------------------------------------
   Save outputs (JSON + XLSX)
------------------------------------------------------ */
async function saveOutputs(rows, header, outDir) {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const ts = Date.now();
  const jsonPath = path.join(outDir, `winners_${ts}.json`);
  const xlsxPath = path.join(outDir, `winners_${ts}.xlsx`);

  fs.writeFileSync(jsonPath, JSON.stringify({ header, rows }, null, 2));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Winners PO");

  sheet.addRow(["CustomerName", header.CustomerName || ""]);
  sheet.addRow(["PONumber", header.PONumber || ""]);
  sheet.addRow(["OrderDate", header.OrderDate || ""]);
  sheet.addRow(["DeliveryDate", header.DeliveryDate || ""]);
  sheet.addRow([]);

  const headers = [
    "ArticleNo",
    "EAN",
    "Description",
    "NbColis",
    "PCB",
    "Qty",
    "Price",
    "Promo",
    "Tax",
  ];
  sheet.addRow(headers);

  rows.forEach((r) => {
    sheet.addRow(headers.map((k) => r[k] || ""));
  });

  await workbook.xlsx.writeFile(xlsxPath);

  return { jsonPath, xlsxPath };
}

/* ------------------------------------------------------
   Extract header from flattened text (simple)
------------------------------------------------------ */
function extractHeaderFromFlat(flatRows) {
  // Build a long text for regex matching
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

  // trim
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

  if (!checkJava()) {
    throw new Error("Java is not installed or not in PATH.");
  }

  if (!fs.existsSync(jarPath)) {
    throw new Error(`Tabula JAR not found at: ${jarPath}`);
  }

  // Run tabula
  const parsed = await runTabula(pdfPath, jarPath);

  // Flatten pages to rows of cell text
  const flat = flattenTabula(parsed);

  // Merge continuation lines where description wraps to next PDF line
  const merged = mergeContinuations(flat);

  // Extract header from flattened rows
  const header = extractHeaderFromFlat(flat);

  // Parse merged rows to structured fields
  const rows = parseMergedRows(merged);

  // Persist outputs
  const outDir = opts.saveTo || path.join(__dirname, "..", "output");
  const { jsonPath, xlsxPath } = await saveOutputs(rows, header, outDir);

  // Columns for frontend (Quasar)
  const columns = [
    { name: "ArticleNo", label: "Article No", field: "ArticleNo" },
    { name: "EAN", label: "EAN", field: "EAN" },
    { name: "Description", label: "Description", field: "Description" },
    { name: "NbColis", label: "Nb Colis", field: "NbColis" },
    { name: "PCB", label: "PCB", field: "PCB" },
    { name: "Qty", label: "Qty", field: "Qty" },
    { name: "Price", label: "Price", field: "Price" },
    { name: "Promo", label: "Promo/Tax", field: "Promo" },
    { name: "Tax", label: "Tax", field: "Tax" },
  ];

  return {
    header,
    rows,
    columns,
    jsonPath,
    xlsxPath,
  };
}

module.exports = { extractWinners };
