/**
 * api.js — Express REST API (async db version)
 *
 * Endpoints:
 *   GET    /api/alerts          — list all alerts
 *   POST   /api/alerts          — create a new alert
 *   PATCH  /api/alerts/:id      — update status (active/paused)
 *   DELETE /api/alerts/:id      — delete an alert
 *   GET    /health              — uptime check
 */

const express = require("express");
const { randomUUID } = require("crypto");
const db = require("./db");
const log = require("./logger");

const app = express();
app.use(express.json());

// Allow requests from the React frontend
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ─── Facility IDs (Recreation.gov) ───────────────────────────────────────────

const FACILITY_IDS = {
  yosemite_wilderness:   "232447",
  john_muir:             "233261",
  mount_whitney:         "233260",
  desolation_wilderness: "445856",
};

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/api/alerts", async (req, res) => {
  try {
    const alerts = await db.getAllAlerts();
    res.json(alerts.map(formatAlert));
  } catch (err) {
    log.error(`[api] GET /api/alerts failed: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/alerts", async (req, res) => {
  try {
    const { locationId, zoneId, dates, groupSize, phone } = req.body;

    const errors = [];
    if (!locationId) errors.push("locationId is required");
    if (!zoneId) errors.push("zoneId is required");
    if (!Array.isArray(dates) || dates.length === 0) errors.push("dates must be a non-empty array");
    if (!phone) errors.push("phone is required");
    if (groupSize < 1 || groupSize > 12) errors.push("groupSize must be between 1 and 12");

    const facilityId = FACILITY_IDS[locationId];
    if (!facilityId) errors.push(`Unknown locationId: ${locationId}`);

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join("; ") });
    }

    const alert = await db.createAlert({
      id: randomUUID(),
      locationId,
      facilityId,
      zoneId,
      dates,
      groupSize: groupSize || 1,
      phone,
    });

    log.info(`[api] Created alert ${alert.id} for ${locationId}/${zoneId}`);
    res.status(201).json(formatAlert(alert));
  } catch (err) {
    log.error(`[api] POST /api/alerts failed: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.patch("/api/alerts/:id", async (req, res) => {
  try {
    const alert = await db.getAlert(req.params.id);
    if (!alert) return res.status(404).json({ error: "Alert not found" });

    const { status } = req.body;
    if (!["active", "paused"].includes(status)) {
      return res.status(400).json({ error: "status must be 'active' or 'paused'" });
    }

    await db.updateAlertStatus(alert.id, status);
    log.info(`[api] Alert ${alert.id} set to ${status}`);
    res.json(formatAlert(await db.getAlert(alert.id)));
  } catch (err) {
    log.error(`[api] PATCH /api/alerts/:id failed: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/alerts/:id", async (req, res) => {
  try {
    const alert = await db.getAlert(req.params.id);
    if (!alert) return res.status(404).json({ error: "Alert not found" });

    await db.deleteAlert(alert.id);
    log.info(`[api] Deleted alert ${alert.id}`);
    res.sendStatus(204);
  } catch (err) {
    log.error(`[api] DELETE /api/alerts/:id failed: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Format helper ────────────────────────────────────────────────────────────

function formatAlert(a) {
  return {
    id:          a.id,
    locationId:  a.location_id,
    facilityId:  a.facility_id,
    zoneId:      a.zone_id,
    dates:       JSON.parse(a.dates),
    groupSize:   a.group_size,
    phone:       a.phone,
    status:      a.status,
    createdAt:   a.created_at,
    lastChecked: a.last_checked,
  };
}

// ─── Start (standalone: node api.js) ─────────────────────────────────────────

const PORT = process.env.PORT || 3001;

async function start() {
  await db.init();
  app.listen(PORT, () => {
    log.info(`[api] Server listening on port ${PORT}`);
  });
}

module.exports = { app, start };

if (require.main === module) {
  start().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
  });
}
