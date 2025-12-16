// server/index.js

require("dotenv").config(); // ✅ Load .env
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

//  DYNAMIC CORS (DEV + IIS + PROD SAFE)
const allowedOrigins = [
  "http://localhost:9000",
  "http://localhost:8090",
  "http://127.0.0.1:8090",
  // "http://192.168.16.12:8090",
  // "http://192.168.16.12:9000",
  "http://192.168.1.45:8090",
  "http://192.168.1.45:9000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow server-to-server or tools like Postman
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS BLOCKED: " + origin), false);
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization", "sap-cookies"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ API routes

app.use("/api/customers", require("./api/routes/customers"));
app.use("/api/extract", require("./api/routes/extract"));
app.use("/api/pdf", require("./api/routes/pdf"));
app.use("/api/auth", require("./api/routes/auth"));
app.use("/api/sap", require("./api/routes/sapRoutes"));

// ✅ Upload folder
const upload = multer({
  dest: path.join(__dirname, "uploads/"),
});

// ✅ Serve Excel/JSON from /output
app.use("/output", express.static(path.join(__dirname, "output")));

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.message);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Express API running on http://0.0.0.0:${PORT}`);
});
