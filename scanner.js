/**
 * Permit Scout — Backend Scanner Service
 * 
 * Polls Recreation.gov every 15 minutes for wilderness permit availability.
 * Sends SMS via Twilio when a permit opens on a watched date.
 * Stores alerts in SQLite so they survive restarts.
 * 
 * Supported locations:
 *   - Yosemite Wilderness
 *   - John Muir Trail
 *   - Mount Whitney
 *   - Desolation Wilderness
 */

require("dotenv").config();
const cron = require("node-cron");
const db = require("./db");
const { checkPermitAvailability } = require("./recreation-gov");
const { sendSMS } = require("./twilio");
const log = require("./logger");

// ─── Scan all active alerts ───────────────────────────────────────────────────

async function scanAll() {
  const alerts = db.getActiveAlerts();
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

async function scanAlert(alert) {
  const { id, location_id, facility_id, zone_id, dates, group_size, phone } = alert;
  const dateList = JSON.parse(dates);

  log.info(`[${id}] Checking ${location_id} / ${zone_id} for ${dateList.length} date(s)...`);

  for (const date of dateList) {
    // Skip dates we've already notified about
    if (db.wasNotified(id, date)) continue;

    const available = await checkPermitAvailability({
      facilityId: facility_id,
      date,
      groupSize: group_size,
    });

    db.updateLastChecked(id);

    if (available) {
      log.info(`[${id}] ✅ PERMIT FOUND for ${date}! Sending SMS to ${phone}`);
      
      const bookingUrl = `https://www.recreation.gov/permits/${facility_id}/registration/detailed-availability?date=${date}`;
      const locationName = getLocationName(location_id);
      const zoneName = getZoneName(location_id, zone_id);
      const friendlyDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "short", month: "long", day: "numeric", year: "numeric",
      });

      const message =
        `🏔 PERMIT AVAILABLE\n` +
        `${locationName} — ${zoneName}\n` +
        `📅 ${friendlyDate}\n` +
        `👥 ${group_size} ${group_size === 1 ? "person" : "people"}\n` +
        `\n👉 Book now:\n${bookingUrl}`;

      await sendSMS({ to: phone, body: message });
      db.markNotified(id, date);
      log.info(`[${id}] SMS sent for ${date}.`);
    } else {
      log.info(`[${id}] No availability for ${date}.`);
    }

    // Be polite to the API — small delay between date checks
    await sleep(500);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LOCATIONS = {
  yosemite_wilderness: {
    name: "Yosemite Wilderness",
    zones: {
      mcgurk_dewey:     "McGurk Meadow / Dewey Point",
      tuolumne:         "Tuolumne Meadows",
      hetch_hetchy:     "Hetch Hetchy",
      half_dome:        "Half Dome Cables",
      little_yosemite:  "Little Yosemite Valley",
      cloud_rest:       "Cloud's Rest",
    },
  },
  john_muir: {
    name: "John Muir Trail",
    zones: {
      happy_isles_lyell: "Happy Isles → Lyell Canyon",
      muir_pass:         "Muir Pass",
    },
  },
  mount_whitney: {
    name: "Mount Whitney Trail",
    zones: {
      main_trail: "Main Trail Day Hike",
      overnight:  "Overnight Permit",
    },
  },
  desolation_wilderness: {
    name: "Desolation Wilderness",
    zones: {
      echo_lake: "Echo Lake Trailhead",
      bayview:   "Bayview Trailhead",
    },
  },
};

function getLocationName(locationId) {
  return LOCATIONS[locationId]?.name || locationId;
}

function getZoneName(locationId, zoneId) {
  return LOCATIONS[locationId]?.zones[zoneId] || zoneId;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  log.info("🏕  Permit Scout starting up...");
  db.init();

  // Run immediately on startup
  await scanAll();

  // Then every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    log.info("--- Scheduled scan starting ---");
    await scanAll();
  });

  log.info("✅ Scanner running. Checks every 15 minutes.");
}

main().catch((err) => {
  log.error("Fatal startup error:", err);
  process.exit(1);
});
