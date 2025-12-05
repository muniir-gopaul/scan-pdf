// backend/services/sapService.js
const https = require("https");
const fetch = require("node-fetch");
const config = require("../config/sap.json");
require("dotenv").config();

/**
 * Posts SAP payload to B1 Service Layer USING SAP SESSION COOKIES
 * @param {*} payload  - SAP Order payload
 * @param {*} sapCookies - "B1SESSION=xyz; ROUTEID=.node1"
 */
async function postToSapService(payload, sapCookies) {
  try {
    // Build final SAP URL
    const endpoint = (process.env.SAP_ENDPOINT || "Orders").replace(/^\//, "");
    const sapUrl = `${config.address}/${endpoint}`;

    console.log("🚀 Posting to SAP URL:", sapUrl);

    // HTTPS agent for self-signed SAP certificate
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });

    // Perform POST with SAP cookies
    const res = await fetch(sapUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sapCookies,
      },
      body: JSON.stringify(payload),
      agent,
    });

    // SAP sometimes returns plain text instead of JSON
    const raw = await res.text();
    let parsed = raw;

    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("⚠️ Non-JSON SAP response");
    }

    console.log("📥 SAP Response:", parsed);

    return {
      success: res.ok,
      status: res.status,
      body: parsed,
    };
  } catch (err) {
    console.error("❌ SAP Service Error:", err);
    return {
      success: false,
      error: err.message,
    };
  }
}

module.exports = { postToSapService };
