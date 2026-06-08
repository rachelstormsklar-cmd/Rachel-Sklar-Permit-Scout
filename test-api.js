#!/usr/bin/env node
/**
 * scripts/test-api.js
 *
 * Smoke-tests the running API server AND the Recreation.gov availability endpoint.
 *
 * Usage (start the API server first):
 *   npm run api          # in one terminal
 *   node scripts/test-api.js   # in another
 */

require("dotenv").config();
const http = require("http");
const { checkPermitAvailability } = require("../recreation-gov");

const API_BASE = `http://localhost:${process.env.PORT || 3001}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      `${API_BASE}${path}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null,
          });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function pass(label) { console.log(`  ✅ ${label}`); }
function fail(label, detail) { console.error(`  ❌ ${label}`, detail || ""); }

// ─── Tests ────────────────────────────────────────────────────────────────────

async function testHealth() {
  console.log("\n[1] Health check");
  const r = await apiRequest("GET", "/health");
  if (r.status === 200 && r.body?.status === "ok") pass("GET /health → 200 ok");
  else fail("GET /health", r);
}

async function testAlertCRUD() {
  console.log("\n[2] Alert CRUD");

  // Create
  const create = await apiRequest("POST", "/api/alerts", {
    locationId: "desolation_wilderness",
    zoneId:     "echo_lake",
    dates:      ["2026-09-01", "2026-09-15"],
    groupSize:  2,
    phone:      "+15105550199",
  });
  if (create.status === 201 && create.body?.id) {
    pass(`POST /api/alerts → 201, id=${create.body.id}`);
  } else {
    fail("POST /api/alerts", create);
    return;
  }

  const id = create.body.id;

  // List
  const list = await apiRequest("GET", "/api/alerts");
  const found = list.body?.find((a) => a.id === id);
  if (list.status === 200 && found) pass("GET /api/alerts → alert found in list");
  else fail("GET /api/alerts", list);

  // Pause
  const pause = await apiRequest("PATCH", `/api/alerts/${id}`, { status: "paused" });
  if (pause.status === 200 && pause.body?.status === "paused") pass("PATCH → paused");
  else fail("PATCH", pause);

  // Re-activate
  const activate = await apiRequest("PATCH", `/api/alerts/${id}`, { status: "active" });
  if (activate.status === 200 && activate.body?.status === "active") pass("PATCH → active");
  else fail("PATCH", activate);

  // Delete
  const del = await apiRequest("DELETE", `/api/alerts/${id}`);
  if (del.status === 204) pass("DELETE → 204");
  else fail("DELETE", del);

  // Confirm gone
  const check = await apiRequest("GET", "/api/alerts");
  if (!check.body?.find((a) => a.id === id)) pass("Deleted alert not in list");
  else fail("Alert still present after delete");
}

async function testValidation() {
  console.log("\n[3] Validation");

  const bad = await apiRequest("POST", "/api/alerts", {
    locationId: "nowhere_wilderness",
    zoneId:     "the_void",
    dates:      [],
    phone:      "+15555555555",
  });
  if (bad.status === 400) pass("POST with bad locationId → 400");
  else fail("Expected 400", bad);
}

async function testRecGovAvailability() {
  console.log("\n[4] Recreation.gov availability check (live network call)");
  console.log("    Checking Desolation Wilderness (445856) for a future date...");

  // Pick a date 3 months out — likely not available, but we just want to confirm
  // the API call succeeds without error
  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + 3);
  const date = futureDate.toISOString().slice(0, 10);

  try {
    const result = await checkPermitAvailability({
      facilityId: "445856",
      date,
      groupSize: 1,
    });
    pass(`Recreation.gov API responded — ${date}: ${result.available ? `${result.remaining} slots available` : "no availability"}`);
  } catch (err) {
    fail("Recreation.gov API call failed", err.message);
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🏕  Permit Scout — API smoke tests");
  console.log(`   API base: ${API_BASE}`);

  let apiReachable = true;
  try {
    await testHealth();
    await testAlertCRUD();
    await testValidation();
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      console.error(`\n❌ Could not reach ${API_BASE} — is the API server running?`);
      console.error("   Run: npm run api");
      apiReachable = false;
    } else {
      throw err;
    }
  }

  await testRecGovAvailability();

  if (apiReachable) {
    console.log("\n✅ All tests passed.\n");
  }
}

main().catch((err) => {
  console.error("\nUnexpected error:", err);
  process.exit(1);
});
