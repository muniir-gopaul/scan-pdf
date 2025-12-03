// backend/api/routes/pdf.js
const express = require("express");
const router = express.Router();

const { savePdfDocument } = require("../controllers/pdfController");

// POST route for saving PDF Header and Lines
router.post("/save", savePdfDocument);

module.exports = router;
