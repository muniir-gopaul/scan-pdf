const express = require("express");
const router = express.Router();
const axios = require("axios");
const { sapLogin } = require("../../services/sapClient");

/* ------------------------------------------------------
   LOGIN
------------------------------------------------------ */
router.post("/login", async (req, res) => {
  const { CompanyDB, UserName, Password } = req.body;

  if (!CompanyDB || !UserName || !Password) {
    return res.status(400).json({
      success: false,
      message: "Missing credentials",
    });
  }

  try {
    const result = await sapLogin({ CompanyDB, UserName, Password });

    if (!result.success) {
      return res.status(401).json(result);
    }

    return res.json({
      success: true,
      sessionId: result.sessionId,
      cookies: result.cookies,
    });
  } catch (err) {
    console.error("🔥 SAP LOGIN ERROR:", err.message);
    return res.status(500).json({
      success: false,
      message: "SAP login failed",
    });
  }
});

/* ------------------------------------------------------
   LOGOUT
------------------------------------------------------ */
router.post("/logout", async (req, res) => {
  try {
    const sapCookies = req.headers["sap-cookies"];

    if (!sapCookies || !process.env.SAP_URL) {
      return res.json({ success: true });
    }

    await axios.post(
      `${process.env.SAP_URL}/Logout`,
      {},
      {
        headers: {
          Cookie: sapCookies,
        },
        timeout: 5000,
      }
    );

    return res.json({ success: true });
  } catch (err) {
    // SAP often throws if session already expired — SAFE TO IGNORE
    console.warn("⚠ SAP logout ignored:", err.message);
    return res.json({ success: true });
  }
});

module.exports = router;
