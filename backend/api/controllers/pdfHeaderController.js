const { savePdfHeader } = require(".././../services/pdfHeaderService");

async function createPdfHeader(req, res) {
  try {
    const result = await savePdfHeader(req.body);
    res.json(result);
  } catch (err) {
    console.error("PDF HEADER SAVE ERROR:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

module.exports = { createPdfHeader };
