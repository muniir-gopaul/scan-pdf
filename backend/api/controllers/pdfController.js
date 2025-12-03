// backend/controllers/pdfController.js
const { savePdfHeader } = require("../../services/pdfHeaderService");
const { savePdfLines } = require("../../services/pdfLinesService");

async function savePdfDocument(req, res) {
  try {
    const { header, lines } = req.body;
    if (!header || !lines) {
      return res.json({ success: false, message: "Missing header or lines" });
    }

    // Save Header and Lines logic
    const headerResult = await savePdfHeader(header);
    const docEntry = headerResult.docEntry;

    if (!docEntry) {
      return res.json({
        success: false,
        message: "DocEntry generation failed",
      });
    }

    // Save lines with docEntry
    const linesResult = await savePdfLines(docEntry, lines);
    console.log("Lines Save Result:", linesResult);
    return res.json({
      success: true,
      docEntry,
      docNum: header.PONumber,
    });
  } catch (err) {
    console.error("❌ SAVE PDF ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

module.exports = { savePdfDocument };
