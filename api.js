/**
 * api.js — Express REST API
 * 
 * Lets the React frontend create, list, and manage alerts.
 * Run alongside scanner.js, or mount into a single server.
 * 
 * Endpoints:
 *   GET    /api/alerts          — list all alerts
 *   POST   /api/alerts          — create a new alert
 *   PATCH  /api/alerts/:id      — update status (active/paused)
 *   DELETE /api/alerts/:id      — delete an alert
 *   GET    /api/alerts/:id/logs — get scan history for an alert
 *   GET    /health              — uptime check
 */

const express = require("express");
const { randomUUID } = require("crypto");
const db = require("./db");
const log = require("./logger");

const app = express();
app.use(express.json());

// Allow requests from the React frontend (adjust origin for production)
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

// GET /health
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// GET /api/alerts
app.get("/api/alerts", (req, res) => {
  const alerts = db.getAllAlerts().map(formatAlert);
  res.json(alerts);
});

// POST /api/alerts
app.post("/api/alerts", (req, res) => {
  const { locationId, zoneId, dates, groupSize, phone } = req.body;

  // Validate
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

  const alert = db.createAlert({
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
});

// PATCH /api/alerts/:id  — { status: "active" | "paused" }
app.patch("/api/alerts/:id", (req, res) => {
  const alert = db.getAlert(req.params.id);
  if (!alert) return res.status(404).json({ error: "Alert not found" });

  const { status } = req.body;
  if (!["active", "paused"].includes(status)) {
    return res.status(400).json({ error: "status must be 'active' or 'paused'" });
  }

  db.updateAlertStatus(alert.id, status);
  log.info(`[api] Alert ${alert.id} set to ${status}`);
  res.json(formatAlert(db.getAlert(alert.id)));
});

// DELETE /api/alerts/:id
app.delete("/api/alerts/:id", (req, res) => {
  const alert = db.getAlert(req.params.id);
  if (!alert) return res.status(404).json({ error: "Alert not found" });

  db.deleteAlert(alert.id);
  log.info(`[api] Deleted alert ${alert.id}`);
  res.sendStatus(204);
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

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

function start() {
  db.init();
  app.listen(PORT, () => {
    log.info(`[api] Server listening on http://localhost:${PORT}`);
  });
}

module.exports = { app, start };

// Run standalone: node api.js
if (require.main === module) {
  start();
}
