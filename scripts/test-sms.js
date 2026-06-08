#!/usr/bin/env node
/**
 * scripts/test-sms.js
 *
 * Sends a test SMS to verify your Twilio credentials are working.
 *
 * Usage:
 *   node scripts/test-sms.js +15105550100
 *
 * Or set TEST_PHONE in .env and run without args:
 *   node scripts/test-sms.js
 */

require("dotenv").config();
const { sendSMS } = require("../twilio");

const to = process.argv[2] || process.env.TEST_PHONE;

if (!to) {
  console.error("Usage: node scripts/test-sms.js <phone_number>");
  console.error("  e.g. node scripts/test-sms.js +15105550100");
  console.error("\nOr set TEST_PHONE in your .env file");
  process.exit(1);
}

async function main() {
  console.log(`Sending test SMS to ${to}...`);

  await sendSMS({
    to,
    body:
      `🏔 Permit Scout — test message\n` +
      `If you got this, your Twilio setup is working!\n` +
      `${new Date().toLocaleString()}`,
  });

  console.log("✅ SMS sent successfully.");
}

main().catch((err) => {
  console.error("❌ Failed to send SMS:", err.message);
  console.error("\nDouble-check these .env values:");
  console.error("  TWILIO_ACCOUNT_SID  =", process.env.TWILIO_ACCOUNT_SID ? "set ✓" : "MISSING ✗");
  console.error("  TWILIO_AUTH_TOKEN   =", process.env.TWILIO_AUTH_TOKEN  ? "set ✓" : "MISSING ✗");
  console.error("  TWILIO_FROM_NUMBER  =", process.env.TWILIO_FROM_NUMBER  ? "set ✓" : "MISSING ✗");
  process.exit(1);
});
