/**
 * recreation-gov.js — Recreation.gov RIDB API client
 * 
 * Docs: https://ridb.recreation.gov/docs
 * Get a free API key at: https://ridb.recreation.gov/
 *
 * Permit availability endpoint:
 *   GET /api/v1/permits/{facilityId}/availability/month
 *   ?start_date=YYYY-MM-01&commercial_acces=false
 */

const https = require("https");
const log = require("./logger");

const BASE_URL = "https://www.recreation.gov";
const API_KEY = process.env.RIDB_API_KEY;

if (!API_KEY) {
  console.warn("[recreation-gov] WARNING: RIDB_API_KEY not set. API calls will fail.");
}

/**
 * Check if a permit is available for a given facility, date, and group size.
 * Returns true if at least one slot is open.
 */
async function checkPermitAvailability({ facilityId, date, groupSize = 1 }) {
  // Derive the month start for the availability query
  const [year, month] = date.split("-");
  const startDate = `${year}-${month}-01T00:00:00.000Z`;

  const path =
    `/api/v1/permits/${facilityId}/availability/month` +
    `?start_date=${encodeURIComponent(startDate)}&commercial_acces=false`;

  log.debug(`[rec.gov] GET ${path}`);

  let data;
  try {
    data = await request(path);
  } catch (err) {
    log.error(`[rec.gov] API request failed: ${err.message}`);
    return false;
  }

  return parseDateAvailability(data, date, groupSize);
}

/**
 * Parse the availability response and check if our target date has open slots.
 *
 * Recreation.gov returns a structure like:
 * {
 *   payload: {
 *     permit_entrance_id: {
 *       date_availability: {
 *         "YYYY-MM-DDTHH:mm:ssZ": {
 *           remaining: 5,
 *           total: 25,
 *           is_reserve_date: true,
 *           ...
 *         }
 *       }
 *     }
 *   }
 * }
 */
function parseDateAvailability(data, targetDate, groupSize) {
  try {
    const payload = data?.payload || data?.availability;
    if (!payload) {
      log.warn("[rec.gov] Unexpected API response shape:", JSON.stringify(data).slice(0, 200));
      return false;
    }

    // Iterate over all permit entrances (trailheads / zones)
    for (const entranceId of Object.keys(payload)) {
      const entrance = payload[entranceId];
      const dateAvailability = entrance?.date_availability || entrance?.availabilities || {};

      for (const [dateKey, slot] of Object.entries(dateAvailability)) {
        // Date keys look like "2026-08-01T00:00:00Z"
        if (!dateKey.startsWith(targetDate)) continue;

        const remaining = slot.remaining ?? slot.available ?? 0;
        if (remaining >= groupSize) {
          log.info(`[rec.gov] Found ${remaining} slot(s) available for ${targetDate} at entrance ${entranceId}`);
          return true;
        }
      }
    }

    return false;
  } catch (err) {
    log.error(`[rec.gov] Error parsing availability: ${err.message}`);
    return false;
  }
}

/**
 * Fetch all permit entrances (zones/trailheads) for a facility.
 * Useful for debugging and seeding new locations.
 */
async function getPermitEntrances(facilityId) {
  const path = `/api/v1/permitentrances?facility_id=${facilityId}&limit=50`;
  return request(path);
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function request(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "ridb.recreation.gov",
      path,
      method: "GET",
      headers: {
        apikey: API_KEY,
        Accept: "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.end();
  });
}

module.exports = { checkPermitAvailability, getPermitEntrances };
