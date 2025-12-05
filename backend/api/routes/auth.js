// backend/api/routes/auth.js
const express = require("express");
const router = express.Router();
const { sapLogin } = require("../../services/sapClient");

router.post("/login", async (req, res) => {
  const { CompanyDB, UserName, Password } = req.body;

  if (!CompanyDB || !UserName || !Password) {
    return res.status(400).json({
      success: false,
      message: "Missing credentials",
    });
  }

  const result = await sapLogin({ CompanyDB, UserName, Password });

  if (!result.success) {
    return res.status(401).json(result);
  }

  res.json({
    success: true,
    sessionId: result.sessionId,
    cookies: result.cookies,
  });
});

module.exports = router;
