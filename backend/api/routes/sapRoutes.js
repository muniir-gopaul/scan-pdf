// backend/api/routes/sapRoutes.js
const express = require("express");
const router = express.Router();
const { postToSapService } = require("../../services/sapService");
const requireSapSession = require('../middleware/requireSapSession');
router.post("/post", requireSapSession, async (req, res) => {
  try {
    const payload = req.body;
    const sapCookies = req.headers["sap-cookies"];

    if (!sapCookies) {
      return res.status(400).json({
        success: false,
        message: "Missing SAP session cookies",
      });
    }

    console.log("🍪 Received SAP cookies:", sapCookies);

    const result = await postToSapService(payload, sapCookies);

    res.json({
      success: result.success,
      sapResponse: result.body,
    });
  } catch (err) {
    console.error("❌ SAP Route Error:", err.message);
    res.status(500).json({ success: false, message: "SAP Posting Failed" });
  }
});

module.exports = router;
