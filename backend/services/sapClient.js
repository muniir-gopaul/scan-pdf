const axios = require("axios");
const https = require("https");
const config = require("../config/sap.json");

const apiClient = axios.create({
  withCredentials: true,
  baseURL: config.address,
  responseType: "json",
  headers: {
    "Content-Type": "application/json",
  },
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
});

async function sapLogin({ CompanyDB, UserName, Password }) {
  try {
    const response = await apiClient.post("/Login", {
      CompanyDB,
      UserName,
      Password,
    });

    return {
      success: true,
      sessionId: response.data.SessionId,
      cookies: response.headers["set-cookie"],
    };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.error?.message?.value || "SAP Login Failed",
    };
  }
}

module.exports = { sapLogin };
