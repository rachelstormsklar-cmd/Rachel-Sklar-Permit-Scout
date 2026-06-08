/**
 * recreation-gov.js — Recreation.gov availability API client
 *
 * TWO separate APIs exist:
 *   1. ridb.recreation.gov  — facility/permit *metadata* (needs RIDB_API_KEY)
 *   2. www.recreation.gov   — *availability* data (no API key required — it's
 *                             the same JSON the browser fetches when you open
 *                             a permit page)
 *
 * We use #2 for availability checks because the RIDB API does not expose
 * real-time slot counts.
 *
 * Permit availability endpoint:
 *   GET https://www.recreation.gov/api/v1/permits/{facilityId}/availability/month
 *       ?start_date=YYYY-MM-01T00%3A00%3A00.000Z
 *
 * Response shape (simplified):
 *   {
 *     payload: {
 *       "{division_id}": {          // division = zone / trailhead entrance
 *         date_availability: {
 *           "YYYY-MM-DDTHH:mm:ssZ": {
 *             remaining: 5,
 *             total: 25,
 *             show_walkup: false,
 *             ...
 *           }
 *         }
 *       }
 *     }
 *   }
 */

const https = require("https");
const log = require("./logger");

const AVAILABILITY_HOST = "www.recreation.gov";

/**
 * Check permit availability for a single date.
 *
 * @param {string} facilityId   - Recreation.gov facility ID (e.g. "232447")
 * @param {string} date         - ISO date string "YYYY-MM-DD"
 * @param {number} groupSize    - minimum slots needed
 * @param {string} [divisionId] - optional zone/trailhead ID to narrow results
 * @returns {Promise<{available: boolean, remaining: number, divisionId: string|null}>}
 */
async function checkPermitAvailability({ facilityId, date, groupSize = 1, divisionId = null }) {
  const [year, month] = date.split("-");
  const startDate = `${year}-${month}-01T00:00:00.000Z`;
  const path =
    `/api/v1/permits/${facilityId}/availability/month` +
    `?start_date=${encodeURIComponent(startDate)}`;

  log.debug(`[rec.gov] Checking: facility=${facilityId} date=${date} group=${groupSize}`);

  let data;
  try {
    data = await request(AVAILABILITY_HOST, path);
  } catch (err) {
    log.error(`[rec.gov] Request failed: ${err.message}`);
    return { available: false, remaining: 0, divisionId: null };
  }

  return parsePermitAvailability(data, date, groupSize, divisionId);
}

/**
 * Parse the monthly availability payload and find open slots for target date.
 */
function parsePermitAvailability(data, targetDate, groupSize, filterDivisionId) {
  try {
    const payload = data?.payload;
    if (!payload) {
      log.warn("[rec.gov] Unexpected response — no 'payload' key:", JSON.stringify(data).slice(0, 300));
      return { available: false, remaining: 0, divisionId: null };
    }

    for (const [divId, division] of Object.entries(payload)) {
      if (filterDivisionId && divId !== filterDivisionId) continue;

      const dateAvail = division?.date_availability ?? {};

      for (const [dateKey, slot] of Object.entries(dateAvail)) {
        // dateKey looks like "2026-08-01T00:00:00Z"
        if (!dateKey.startsWith(targetDate)) continue;

        const remaining = slot.remaining ?? 0;

        if (remaining >= groupSize) {
          log.info(`[rec.gov] ✅ ${remaining} slot(s) available for ${targetDate} (division ${divId})`);
          return { available: true, remaining, divisionId: divId };
        } else {
          log.debug(`[rec.gov] Division ${divId} / ${targetDate}: ${remaining} remaining (need ${groupSize})`);
        }
      }
    }

    return { available: false, remaining: 0, divisionId: null };
  } catch (err) {
    log.error(`[rec.gov] Parse error: ${err.message}`);
    return { available: false, remaining: 0, divisionId: null };
  }
}

/**
 * Fetch all divisions (zones/trailheads) for a permit.
 * Useful for discovering division IDs when adding new locations.
 * Requires RIDB_API_KEY.
 */
async function getPermitDivisions(facilityId) {
  const apiKey = process.env.RIDB_API_KEY;
  if (!apiKey) throw new Error("RIDB_API_KEY not set");
  const path = `/api/v1/permits/${facilityId}/divisions?limit=50`;
  return request("ridb.recreation.gov", path, { apikey: apiKey });
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function request(hostname, path, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "PermitScout/1.0",
        ...extraHeaders,
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
        } else if (res.statusCode === 404) {
          reject(new Error(`Facility ${hostname}${path} not found (404) — check facility ID`));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.end();
  });
}

module.exports = { checkPermitAvailability, getPermitDivisions };
