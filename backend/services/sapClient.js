// backend/services/sapClient.js
const axios = require("axios");
const https = require("https");
require("dotenv").config();

const SAP_BASE = process.env.SAP_URL || "https://192.168.16.16:50000/b1s/v1";

/**
 * Creates SAP SL HTTPS agent (for self-signed certificate)
 */
const sapHttpsAgent = new https.Agent({
  rejectUnauthorized: false, // ⬅️ disables cert validation for SL
});

/**
 * Login to SAP B1 Service Layer
 */
async function sapLogin({ CompanyDB, UserName, Password }) {
  const url = `${SAP_BASE}/Login`;

  console.log("➡️ SAP LOGIN ATTEMPT:", { CompanyDB, UserName });

  try {
    const response = await axios.post(
      url,
      { CompanyDB, UserName, Password },
      { httpsAgent: sapHttpsAgent }
    );

    // SAP returns cookies in headers
    const rawCookies = response.headers["set-cookie"] || [];

    const sessionId = response.data.SessionId;
    const routeId = rawCookies.find((c) => c.startsWith("ROUTEID=")) || "";
    const sapSessionCookie =
      rawCookies.find((c) => c.startsWith("B1SESSION=")) || "";

    console.log("✅ SAP LOGIN SUCCESS", { sessionId });

    return {
      success: true,
      sessionId,
      cookies: {
        B1SESSION: sapSessionCookie,
        ROUTEID: routeId,
      },
    };
  } catch (err) {
    console.error("🔥🔥🔥 SAP LOGIN HARD ERROR 🔥🔥🔥");
    console.error("ERR.MESSAGE:", err.message);
    console.error("ERR.CODE:", err.code);
    console.error("ERR.CONFIG.URL:", err.config?.url);
    console.error("NO RESPONSE FROM SAP (TLS or Network Failure)");

    return {
      success: false,
      message: err.message,
      code: err.code,
    };
  }
}

module.exports = { sapLogin, sapHttpsAgent };
