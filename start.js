require("dotenv").config();

const { app } = require("./api");
const db = require("./db");
const log = require("./logger");
const cron = require("node-cron");
const { checkPermitAvailability } = require("./recreation-gov");
const { sendSMS } = require("./twilio");

const PORT = process.env.PORT || 3001;

async function scanAlert(alert) {
  const { id, location_id, facility_id, zone_id, dates, group_size, phone } = alert;
  const dateList = JSON.parse(dates);
  for (const date of dateList) {
    if (await db.wasNotified(id, date)) continue;
    const { available } = await checkPermitAvailability({
      facilityId: facility_id,
      date,
      groupSize: group_size,
    });
    await db.updateLastChecked(id);
    if (available) {
      const bookingUrl = `https://www.recreation.gov/permits/${facility_id}/registration/detailed-availability?date=${date}`;
      const msg = `🏔 PERMIT AVAILABLE\n${location_id} — ${zone_id}\n📅 ${date}\n👥 ${group_size}\n\n👉 Book now:\n${bookingUrl}`;
      await sendSMS({ to: phone, body: msg });
      await db.markNotified(id, date);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function scanAll() {
  const alerts = await db.getActiveAlerts();
  if (alerts.length === 0) {
    log.info("No active alerts to scan.");
    return;
  }
  log.info(`Scanning ${alerts.length} active alert(s)...`);
  for (const alert of alerts) {
    try {
      await scanAlert(alert);
    } catch (err) {
      log.error(`Error scanning alert ${alert.id}: ${err.message}`);
    }
  }
}

async function main() {
  await db.init();

  app.listen(PORT, () => {
    log.info(`[api] Server listening on port ${PORT}`);
  });

  scanAll();
  cron.schedule("*/15 * * * *", () => {
    log.info("--- Scheduled scan ---");
    scanAll();
  });
  log.info("✅ Scanner running. Checks every 15 minutes.");
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
