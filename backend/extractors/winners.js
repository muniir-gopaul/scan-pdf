const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

async function extractWinners(pdfPath) {
  return new Promise((resolve, reject) => {
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return reject(new Error("Invalid PDF path"));
    }

    const pyScript = path.join(__dirname, "winners_extractor.py");

    if (!fs.existsSync(pyScript)) {
      return reject(new Error("Winners Python extractor not found"));
    }

    execFile(
      "python",
      [pyScript, pdfPath],
      {
        maxBuffer: 1024 * 1024 * 50,
        windowsHide: true,
      },
      (err, stdout, stderr) => {
        if (err) {
          console.error("❌ Winners Python failed:", stderr || err);
          return reject(err);
        }

        if (!stdout) {
          return reject(new Error("No output from Winners extractor"));
        }

        try {
          const parsed = JSON.parse(stdout);

          // 🔒 CONTRACT CHECK (NO REGRESSION)
          if (!parsed.rows || !Array.isArray(parsed.rows)) {
            throw new Error("Invalid Winners payload structure");
          }

          resolve(parsed);
        } catch (e) {
          console.error("❌ Invalid JSON from Winners:\n", stdout);
          reject(
            new Error("Failed to parse Winners extractor output: " + e.message)
          );
        }
      }
    );
  });
}

module.exports = { extractWinners };
