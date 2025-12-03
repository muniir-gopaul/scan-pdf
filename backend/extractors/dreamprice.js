// backend/extractors/dreamprice.js
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const ExcelJS = require("exceljs");

/* ------------------------------------------------------
   1. CHECK JAVA
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
   2. EXTRACT HEADER USING pdf-parse
------------------------------------------------------ */
async function extractHeader(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const parsed = await pdfParse(dataBuffer);
  const text = parsed.text;

  const header = {};

  // Customer Name
  const custName = text.match(
    /(Seven Seven Co Ltd|CUSTOMER\s*:?\s*([A-Za-z0-9 .&-]+))/i
  );
  if (custName) {
    header.CustomerName = custName[2] || custName[1];
  }

  // Customer Code (BRN)
  const custCode = text.match(/C0[0-9]{6,}/i);
  if (custCode) header.CustomerCode = custCode[0];

  // PO Number
  const poN = text.match(/PURCHASE ORDER\s*([0-9A-Za-z]+)/i);
  if (poN) header.PONumber = poN[1];

  // **Capture Delivery Date first** (this regex is more specific)
  const delD = text.match(
    /Delivery\s*Date\s*[:\-]?\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i
  );
  if (delD) {
    header.DeliveryDate = delD[1].trim(); // Clean up spaces around the date
    console.log("Delivery Date Match:", header.DeliveryDate); // Debugging line
  }

  // **Capture the next "Date" as Order Date** (it will be the next date in the document)
  const orderD = text.match(/Date\s+([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
  if (orderD && !header.OrderDate) {
    header.OrderDate = orderD[1].trim();
    console.log("Order Date Match:", header.OrderDate); // Debugging line
  }
  return header;
}

/* ------------------------------------------------------
   3. RUN TABULA (STREAM MODE)
------------------------------------------------------ */
function runTabula(pdfPath, jarPath) {
  return new Promise((resolve, reject) => {
    const cmd = `java -jar "${jarPath}" --stream -p all -f JSON "${pdfPath}"`;

    exec(cmd, { maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
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
   4. PARSE DREAMPRICE ROWS
------------------------------------------------------ */
function parseDreampriceRows(parsedTabula) {
  const flat = [];

  // Flatten Tabula rows
  parsedTabula.forEach((page) => {
    (page.data || []).forEach((row) => {
      flat.push(row.map((c) => (c && c.text ? c.text.trim() : "")));
    });
  });

  // Filter rows starting with a barcode
  const itemRows = flat.filter((r) => /^[0-9]{7,14}$/.test(r[0]));

  const finalRows = itemRows.map((r, index) => {
    const barcode = r[0] || "";
    const description = r[1] || "";
    const col3 = r[2] || "";
    const col4 = r[3] || "";

    let tax = "";
    let qty = "";
    let price = "";
    let total = "";

    const parts = col3.split(/\s+/).filter(Boolean);

    if (parts.length >= 4) {
      // Example: VAT 12 97.75 1,173.00
      tax = parts[0];
      qty = parts[1];
      price = parts[2];
      total = parts.slice(3).join(" ");
    } else if (parts.length === 3 && col4) {
      // VAT 24 30.40 + total in next cell
      tax = parts[0];
      qty = parts[1];
      price = parts[2];
      total = col4;
    } else if (parts.length === 2 && col4) {
      // ZERO 10 + total only
      tax = parts[0];
      qty = parts[1];
      price = "";
      total = col4;
    } else {
      // fallback
      tax = parts[0] || "";
      qty = parts[1] || "";
      price = parts[2] || "";
      total = parts[3] || col4;
    }

    return {
      _id: index + 1,
      Barcode: barcode,
      Description: description,
      Tax: tax,
      Qty: qty,
      PU_HT: price,
      Total_HT: total,
    };
  });

  const columns = [
    { name: "Barcode", label: "Barcode", field: "Barcode", align: "left" },
    {
      name: "Description",
      label: "Description",
      field: "Description",
      align: "left",
    },
    { name: "Tax", label: "Tax", field: "Tax", align: "left" },
    { name: "Qty", label: "Qty", field: "Qty", align: "right" },
    { name: "PU_HT", label: "PU (HT)", field: "PU_HT", align: "right" },
    {
      name: "Total_HT",
      label: "Total (HT)",
      field: "Total_HT",
      align: "right",
    },
  ];

  return { columns, rows: finalRows };
}

/* ------------------------------------------------------
   5. SAVE JSON + XLSX
------------------------------------------------------ */
async function saveOutputs(rows, header, outDir) {
  console.log("Extracted Header:", header);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const ts = Date.now();
  const jsonPath = path.join(outDir, `dreamprice_${ts}.json`);
  const xlsxPath = path.join(outDir, `dreamprice_${ts}.xlsx`);

  // Save JSON
  fs.writeFileSync(jsonPath, JSON.stringify({ header, rows }, null, 2));

  // Save Excel
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");

  // Add header rows
  sheet.addRow(["CustomerName", header.CustomerName || ""]);
  sheet.addRow(["CustomerCode", header.CustomerCode || ""]);
  sheet.addRow(["PONumber", header.PONumber || ""]);
  sheet.addRow(["OrderDate", header.OrderDate || ""]);
  sheet.addRow(["DeliveryDate", header.DeliveryDate || ""]);
  sheet.addRow([]);

  const tableHeaders = [
    "Barcode",
    "Description",
    "Tax",
    "Qty",
    "PU_HT",
    "Total_HT",
  ];
  sheet.addRow(tableHeaders);

  rows.forEach((r) => {
    sheet.addRow(tableHeaders.map((k) => r[k]));
  });

  await workbook.xlsx.writeFile(xlsxPath);

  return { jsonPath, xlsxPath };
}

/* ------------------------------------------------------
   6. MAIN EXTRACTOR
------------------------------------------------------ */
async function extractDreamprice(pdfPath, opts = {}) {
  const jarPath = path.join(__dirname, "..", "tabula", "tabula.jar");

  if (!checkJava()) {
    throw new Error("Java is not installed or not in PATH.");
  }

  if (!fs.existsSync(jarPath)) {
    throw new Error(`Tabula JAR not found at: ${jarPath}`);
  }

  const header = await extractHeader(pdfPath);

  const tabulaData = await runTabula(pdfPath, jarPath);

  const { columns, rows } = parseDreampriceRows(tabulaData);

  const outDir = opts.saveTo || path.join(__dirname, "..", "output");
  const { jsonPath, xlsxPath } = await saveOutputs(rows, header, outDir);

  return {
    header,
    columns,
    rows,
    jsonPath,
    xlsxPath,
  };
}

module.exports = { extractDreamprice };
