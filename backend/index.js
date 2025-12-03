// server/index.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
// Extractors
const { extractDreamprice } = require("./extractors/dreamprice");
const { extractWinners } = require("./extractors/winners");

// Normalizer
let normalizeRow = () => ({});
try {
  normalizeRow = require("./extractors/normalize").normalizeRow;
} catch (e) {
  console.warn("⚠ normalizeRow not loaded, using fallback mapper");
}

const app = express();
app.use(
  cors({
    origin: "http://localhost:9000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use("/api/customers", require("./api/routes/customers"));
app.use("/api/extract", require("./api/routes/extract"));
app.use("/api/pdf", require("./api/routes/pdf"));
app.use("/api/auth", require("./api/routes/auth"));

// Upload folder
const upload = multer({
  dest: path.join(__dirname, "uploads/"),
});

// Serve Excel/JSON from /output
app.use("/output", express.static(path.join(__dirname, "output")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PDF extractor listening on ${PORT}`));
