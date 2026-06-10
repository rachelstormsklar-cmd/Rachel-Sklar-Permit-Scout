require("dotenv").config();

// Start the API server
const { app } = require("./api");
const db = require("./db");
const log = require("./logger");

db.init();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  log.info(`[api] Server listening on port ${PORT}`);
});

// Start the scanner cron (without re-initializing db)
const cron = require("node-cron");
const { checkPermitAvailability } = require("./recreation-gov");
const { sendSMS } = require("./twilio");

async function scanAll() {
  const alerts = db.getActiveAlerts();
  if (alerts.length === 0) { log.info("No active alerts to scan."); return; }
  log.info(`Scanning ${alerts.length} active alert(s)...`);
  for (const alert of alerts) {
    try { await scanAlert(alert); } catch(err) { log.error(`Error: ${err.message}`); }
  }
}

async function scanAlert(alert) {
  const { id, location_id, facility_id, zone_id, dates, group_size, phone } = alert;
  const dateList = JSON.parse(dates);
  for (const date of dateList) {
    if (db.wasNotified(id, date)) continue;
    const { available } = await checkPermitAvailability({ facilityId: facility_id, date, groupSize: group_size });
    db.updateLastChecked(id);
    if (available) {
      const bookingUrl = `https://www.recreation.gov/permits/${facility_id}/registration/detailed-availability?date=${date}`;
      const msg = `🏔 PERMIT AVAILABLE\n${location_id} — ${zone_id}\n📅 ${date}\n👥 ${group_size}\n\n👉 Book now:\n${bookingUrl}`;
      await sendSMS({ to: phone, body: msg });
      db.markNotified(id, date);
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

scanAll();
cron.schedule("*/15 * * * *", () => { log.info("--- Scheduled scan ---"); scanAll(); });
log.info("✅ Scanner running. Checks every 15 minutes.");
