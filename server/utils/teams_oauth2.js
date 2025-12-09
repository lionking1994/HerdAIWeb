const axios = require("axios");
const qs = require("qs");

const getAccessToken = async (tenant_id) => {
  const tokenUrl = `https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/token`;
  const data = qs.stringify({
    grant_type: "client_credentials",
    client_id: process.env.TEAMS_CLIENT_ID,
    client_secret: process.env.TEAMS_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
  });
  const response = await axios.post(tokenUrl, data, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  console.log("Access Token Response:", response.data.access_token);
  return response.data.access_token;
};

module.exports = { getAccessToken };
