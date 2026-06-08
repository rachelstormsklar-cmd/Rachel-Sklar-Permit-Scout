/**
 * db.js — SQLite persistence layer
 * 
 * Tables:
 *   alerts        — one row per user alert
 *   notifications — tracks which (alert, date) pairs have already been texted
 */

const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "permits.db");
let db;

function init() {
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL"); // better concurrent read performance

  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id           TEXT PRIMARY KEY,
      location_id  TEXT NOT NULL,
      facility_id  TEXT NOT NULL,
      zone_id      TEXT NOT NULL,
      dates        TEXT NOT NULL,   -- JSON array of "YYYY-MM-DD" strings
      group_size   INTEGER NOT NULL DEFAULT 1,
      phone        TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'active',  -- active | paused | done
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      last_checked TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      alert_id   TEXT NOT NULL,
      date       TEXT NOT NULL,
      sent_at    TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (alert_id, date)
    );
  `);

  console.log(`[db] Initialized at ${DB_PATH}`);
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

function getActiveAlerts() {
  return db.prepare("SELECT * FROM alerts WHERE status = 'active'").all();
}

function getAlert(id) {
  return db.prepare("SELECT * FROM alerts WHERE id = ?").get(id);
}

function getAllAlerts() {
  return db.prepare("SELECT * FROM alerts ORDER BY created_at DESC").all();
}

function createAlert({ id, locationId, facilityId, zoneId, dates, groupSize, phone }) {
  db.prepare(`
    INSERT INTO alerts (id, location_id, facility_id, zone_id, dates, group_size, phone)
    VALUES (@id, @locationId, @facilityId, @zoneId, @dates, @groupSize, @phone)
  `).run({
    id,
    locationId,
    facilityId,
    zoneId,
    dates: JSON.stringify(dates),
    groupSize,
    phone,
  });
  return getAlert(id);
}

function updateAlertStatus(id, status) {
  db.prepare("UPDATE alerts SET status = ? WHERE id = ?").run(status, id);
}

function deleteAlert(id) {
  db.prepare("DELETE FROM notifications WHERE alert_id = ?").run(id);
  db.prepare("DELETE FROM alerts WHERE id = ?").run(id);
}

function updateLastChecked(id) {
  db.prepare("UPDATE alerts SET last_checked = datetime('now') WHERE id = ?").run(id);
}

// ─── Notifications ────────────────────────────────────────────────────────────

function wasNotified(alertId, date) {
  const row = db.prepare(
    "SELECT 1 FROM notifications WHERE alert_id = ? AND date = ?"
  ).get(alertId, date);
  return !!row;
}

function markNotified(alertId, date) {
  db.prepare(
    "INSERT OR IGNORE INTO notifications (alert_id, date) VALUES (?, ?)"
  ).run(alertId, date);
}

module.exports = {
  init,
  getActiveAlerts,
  getAlert,
  getAllAlerts,
  createAlert,
  updateAlertStatus,
  deleteAlert,
  updateLastChecked,
  wasNotified,
  markNotified,
};
