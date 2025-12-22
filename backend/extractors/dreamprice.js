// backend/extractors/dreamprice.js
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

/* ------------------------------------------------------
   DREAMPRICE → PYTHON EXTRACTOR BRIDGE
   - JS keeps orchestration role
   - Python does ALL extraction
------------------------------------------------------ */

// 🔐 ABSOLUTE python path (NO PATH RELIANCE)
const PYTHON_EXE = "C:\\Python311\\python.exe";

async function extractDreamprice(pdfPath, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return reject(new Error("PDF path is invalid or file does not exist"));
    }

    if (!fs.existsSync(PYTHON_EXE)) {
      return reject(new Error(`Python executable not found at: ${PYTHON_EXE}`));
    }

    const pyScript = path.join(__dirname, "dreamprice_extractor.py");

    if (!fs.existsSync(pyScript)) {
      return reject(new Error(`Python extractor not found at: ${pyScript}`));
    }

    const outDir = opts.saveTo || path.join(__dirname, "..", "output");

    execFile(
      PYTHON_EXE,
      [pyScript, pdfPath, outDir],
      {
        maxBuffer: 1024 * 1024 * 50,
        windowsHide: true,
      },
      (err, stdout, stderr) => {
        if (err) {
          console.error("❌ Python extractor failed:", stderr || err);
          return reject(err);
        }

        if (!stdout) {
          return reject(new Error("Python extractor returned no output"));
        }

        try {
          const parsed = JSON.parse(stdout);

          // 🔒 Defensive contract validation
          if (!parsed.success || !Array.isArray(parsed.rows)) {
            throw new Error("Invalid Python extractor payload");
          }

          resolve(parsed);
        } catch (e) {
          console.error("❌ Invalid JSON from Python:\n", stdout);
          reject(
            new Error("Failed to parse Python extractor output: " + e.message)
          );
        }
      }
    );
  });
}

module.exports = { extractDreamprice };
