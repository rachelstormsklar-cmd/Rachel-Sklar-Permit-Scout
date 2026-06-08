/**
 * twilio.js — SMS notifications via Twilio
 * 
 * Setup:
 *   1. Sign up at https://twilio.com (free trial gives ~$15 credit)
 *   2. Get a phone number (free with trial)
 *   3. Add credentials to .env:
 *      TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *      TWILIO_AUTH_TOKEN=your_auth_token
 *      TWILIO_FROM_NUMBER=+18005551234
 */

const https = require("https");
const log = require("./logger");

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
  console.warn("[twilio] WARNING: Twilio credentials not fully set. SMS will not send.");
}

/**
 * Send an SMS message.
 * @param {string} to   - E.164 phone number, e.g. "+15105550100"
 * @param {string} body - Message text (max 1600 chars; longer messages split into segments)
 */
async function sendSMS({ to, body }) {
  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
    log.warn(`[twilio] Skipping SMS to ${to} — credentials not configured.`);
    log.warn(`[twilio] Message would have been:\n${body}`);
    return;
  }

  const params = new URLSearchParams({ To: to, From: FROM_NUMBER, Body: body });
  const postData = params.toString();

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.twilio.com",
      path: `/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
        Authorization:
          "Basic " + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64"),
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        const parsed = JSON.parse(body);
        if (res.statusCode === 201) {
          log.info(`[twilio] SMS sent ✓ SID: ${parsed.sid}`);
          resolve(parsed);
        } else {
          log.error(`[twilio] Error ${res.statusCode}: ${parsed.message}`);
          reject(new Error(`Twilio error: ${parsed.message}`));
        }
      });
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

module.exports = { sendSMS };
