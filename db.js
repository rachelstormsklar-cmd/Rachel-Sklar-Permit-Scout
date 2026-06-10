/**
 * db.js — SQLite persistence layer (async, using sqlite3)
 * All functions return Promises.
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "permits.db");
let db;

// Promise wrappers around the callback API
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  await new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => (err ? reject(err) : resolve()));
  });

  await run("PRAGMA journal_mode = WAL");

  await exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id           TEXT PRIMARY KEY,
      location_id  TEXT NOT NULL,
      facility_id  TEXT NOT NULL,
      zone_id      TEXT NOT NULL,
      dates        TEXT NOT NULL,
      group_size   INTEGER NOT NULL DEFAULT 1,
      phone        TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'active',
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
  return all("SELECT * FROM alerts WHERE status = 'active'");
}

function getAlert(id) {
  return get("SELECT * FROM alerts WHERE id = ?", [id]);
}

function getAllAlerts() {
  return all("SELECT * FROM alerts ORDER BY created_at DESC");
}

async function createAlert({ id, locationId, facilityId, zoneId, dates, groupSize, phone }) {
  await run(
    `INSERT INTO alerts (id, location_id, facility_id, zone_id, dates, group_size, phone)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, locationId, facilityId, zoneId, JSON.stringify(dates), groupSize, phone]
  );
  return getAlert(id);
}

function updateAlertStatus(id, status) {
  return run("UPDATE alerts SET status = ? WHERE id = ?", [status, id]);
}

async function deleteAlert(id) {
  await run("DELETE FROM notifications WHERE alert_id = ?", [id]);
  await run("DELETE FROM alerts WHERE id = ?", [id]);
}

function updateLastChecked(id) {
  return run("UPDATE alerts SET last_checked = datetime('now') WHERE id = ?", [id]);
}

// ─── Notifications ────────────────────────────────────────────────────────────

async function wasNotified(alertId, date) {
  const row = await get(
    "SELECT 1 FROM notifications WHERE alert_id = ? AND date = ?",
    [alertId, date]
  );
  return !!row;
}

function markNotified(alertId, date) {
  return run(
    "INSERT OR IGNORE INTO notifications (alert_id, date) VALUES (?, ?)",
    [alertId, date]
  );
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
