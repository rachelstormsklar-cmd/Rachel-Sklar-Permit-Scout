import { useState, useEffect, useCallback } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const LOCATIONS = {
  yosemite_wilderness: {
    name: "Yosemite Wilderness",
    zones: {
      mcgurk_dewey:    "McGurk Meadow / Dewey Point",
      tuolumne:        "Tuolumne Meadows",
      hetch_hetchy:    "Hetch Hetchy",
      half_dome:       "Half Dome Cables",
      little_yosemite: "Little Yosemite Valley",
      cloud_rest:      "Cloud's Rest",
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

// ─── API client ───────────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function friendlyDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function timeAgo(iso) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Components ───────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const styles = {
    active: { bg: "#e8f5e9", color: "#2e7d32", dot: "#43a047" },
    paused: { bg: "#fff8e1", color: "#f57f17", dot: "#ffb300" },
    done:   { bg: "#f5f5f5", color: "#757575", dot: "#9e9e9e" },
  };
  const s = styles[status] || styles.done;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 10px", borderRadius: 20,
      background: s.bg, color: s.color,
      fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
      {status}
    </span>
  );
}

function AlertCard({ alert, onToggle, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const locationName = LOCATIONS[alert.locationId]?.name || alert.locationId;
  const zoneName = LOCATIONS[alert.locationId]?.zones[alert.zoneId] || alert.zoneId;

  const handleToggle = async () => {
    setToggling(true);
    await onToggle(alert.id, alert.status === "active" ? "paused" : "active");
    setToggling(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete alert for ${locationName}?`)) return;
    setDeleting(true);
    await onDelete(alert.id);
  };

  return (
    <div style={{
      background: "#fff", borderRadius: 12,
      border: "1px solid #e8eaed",
      padding: "20px 24px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      opacity: alert.status === "paused" ? 0.75 : 1,
      transition: "opacity 0.2s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a" }}>{locationName}</div>
          <div style={{ fontSize: 13, color: "#5f6368", marginTop: 2 }}>📍 {zoneName}</div>
        </div>
        <StatusBadge status={alert.status} />
      </div>

      {/* Dates */}
      <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {alert.dates.map((d) => (
          <span key={d} style={{
            padding: "3px 10px", borderRadius: 6,
            background: "#f1f3f4", color: "#3c4043",
            fontSize: 13, fontWeight: 500,
          }}>
            {friendlyDate(d)}
          </span>
        ))}
      </div>

      {/* Meta */}
      <div style={{ marginTop: 12, fontSize: 12, color: "#80868b", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>👥 {alert.groupSize} {alert.groupSize === 1 ? "person" : "people"}</span>
        <span>📱 {alert.phone}</span>
        <span>🔍 Last checked {timeAgo(alert.lastChecked)}</span>
      </div>

      {/* Actions */}
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button
          onClick={handleToggle}
          disabled={toggling || alert.status === "done"}
          style={{
            padding: "6px 14px", borderRadius: 8, border: "1px solid #dadce0",
            background: "#fff", color: "#3c4043", cursor: "pointer",
            fontSize: 13, fontWeight: 500,
            opacity: toggling || alert.status === "done" ? 0.5 : 1,
          }}
        >
          {toggling ? "…" : alert.status === "active" ? "Pause" : "Resume"}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{
            padding: "6px 14px", borderRadius: 8, border: "1px solid #fad2cf",
            background: "#fff", color: "#c5221f", cursor: "pointer",
            fontSize: 13, fontWeight: 500,
            opacity: deleting ? 0.5 : 1,
          }}
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

function CreateAlertModal({ onClose, onCreate }) {
  const [locationId, setLocationId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [phone, setPhone] = useState("");
  const [groupSize, setGroupSize] = useState(2);
  const [dateInput, setDateInput] = useState("");
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const zones = locationId ? Object.entries(LOCATIONS[locationId]?.zones || {}) : [];

  const addDate = () => {
    if (!dateInput || dates.includes(dateInput)) return;
    setDates([...dates, dateInput].sort());
    setDateInput("");
  };

  const removeDate = (d) => setDates(dates.filter((x) => x !== d));

  const handleSubmit = async () => {
    setError("");
    if (!locationId) return setError("Choose a location.");
    if (!zoneId) return setError("Choose a zone.");
    if (dates.length === 0) return setError("Add at least one date.");
    if (!phone.match(/^\+1\d{10}$/)) return setError("Phone must be in format +15105550100");

    setLoading(true);
    try {
      await onCreate({ locationId, zoneId, dates, groupSize, phone });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = { fontSize: 13, fontWeight: 600, color: "#3c4043", marginBottom: 4, display: "block" };
  const inputStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1px solid #dadce0", fontSize: 14, color: "#1a1a1a",
    boxSizing: "border-box", outline: "none",
    fontFamily: "inherit",
  };
  const selectStyle = { ...inputStyle, background: "#fff", cursor: "pointer" };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#fff", borderRadius: 16, padding: 28,
        width: "100%", maxWidth: 480,
        boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "#1a1a1a" }}>
          New permit alert
        </h2>

        {/* Location */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Location</label>
          <select style={selectStyle} value={locationId} onChange={(e) => { setLocationId(e.target.value); setZoneId(""); }}>
            <option value="">Choose a location…</option>
            {Object.entries(LOCATIONS).map(([id, loc]) => (
              <option key={id} value={id}>{loc.name}</option>
            ))}
          </select>
        </div>

        {/* Zone */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Zone / Trailhead</label>
          <select style={selectStyle} value={zoneId} onChange={(e) => setZoneId(e.target.value)} disabled={!locationId}>
            <option value="">Choose a zone…</option>
            {zones.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>

        {/* Group size */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Group size</label>
          <input
            type="number" min={1} max={12}
            style={{ ...inputStyle, width: 80 }}
            value={groupSize}
            onChange={(e) => setGroupSize(Number(e.target.value))}
          />
        </div>

        {/* Phone */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Phone number (for SMS alerts)</label>
          <input
            type="tel" placeholder="+15105550100"
            style={inputStyle}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <div style={{ fontSize: 11, color: "#80868b", marginTop: 4 }}>E.164 format: +1 followed by 10 digits</div>
        </div>

        {/* Dates */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Dates to watch</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="date" style={{ ...inputStyle, flex: 1 }}
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDate()}
              min={new Date().toISOString().slice(0, 10)}
            />
            <button onClick={addDate} style={{
              padding: "9px 16px", borderRadius: 8,
              background: "#1a73e8", color: "#fff",
              border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
            }}>Add</button>
          </div>

          {dates.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {dates.map((d) => (
                <span key={d} style={{
                  padding: "3px 10px", borderRadius: 6,
                  background: "#e8f0fe", color: "#1a73e8",
                  fontSize: 13, fontWeight: 500,
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                  {friendlyDate(d)}
                  <button onClick={() => removeDate(d)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#1a73e8", padding: 0, fontSize: 14, lineHeight: 1,
                  }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div style={{
            marginBottom: 16, padding: "10px 14px", borderRadius: 8,
            background: "#fce8e6", color: "#c5221f", fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "9px 18px", borderRadius: 8, border: "1px solid #dadce0",
            background: "#fff", color: "#3c4043", cursor: "pointer", fontSize: 14,
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{
            padding: "9px 18px", borderRadius: 8, border: "none",
            background: loading ? "#a8c7fa" : "#1a73e8",
            color: "#fff", cursor: loading ? "not-allowed" : "pointer",
            fontSize: 14, fontWeight: 600,
          }}>
            {loading ? "Creating…" : "Create alert"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [apiDown, setApiDown] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await apiFetch("/api/alerts");
      setAlerts(data);
      setApiDown(false);
      setError("");
    } catch (err) {
      if (err.message.includes("Failed to fetch") || err.message.includes("ECONNREFUSED")) {
        setApiDown(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleCreate = async (payload) => {
    await apiFetch("/api/alerts", { method: "POST", body: JSON.stringify(payload) });
    await fetchAlerts();
  };

  const handleToggle = async (id, status) => {
    await apiFetch(`/api/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await fetchAlerts();
  };

  const handleDelete = async (id) => {
    await apiFetch(`/api/alerts/${id}`, { method: "DELETE" });
    await fetchAlerts();
  };

  const active = alerts.filter((a) => a.status === "active");
  const paused = alerts.filter((a) => a.status === "paused");
  const done   = alerts.filter((a) => a.status === "done");

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #e8eaed",
        padding: "0 24px", height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🏔</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#1a1a1a" }}>Permit Scout</span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: "#1a73e8", color: "#fff",
            cursor: "pointer", fontSize: 14, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          + New alert
        </button>
      </header>

      {/* Body */}
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "28px 16px" }}>

        {/* API down banner */}
        {apiDown && (
          <div style={{
            marginBottom: 20, padding: "12px 16px", borderRadius: 10,
            background: "#fce8e6", color: "#c5221f", fontSize: 14,
          }}>
            ⚠️ Can't reach the API server at <code>{API_BASE}</code>. Make sure it's running with <code>npm run api</code>.
          </div>
        )}

        {error && (
          <div style={{
            marginBottom: 20, padding: "12px 16px", borderRadius: 10,
            background: "#fce8e6", color: "#c5221f", fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#80868b" }}>Loading alerts…</div>
        ) : alerts.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            background: "#fff", borderRadius: 12, border: "1px solid #e8eaed",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏕</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>No alerts yet</div>
            <div style={{ fontSize: 14, color: "#80868b", marginBottom: 20 }}>
              Set one up and get a text the moment a permit opens.
            </div>
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: "10px 20px", borderRadius: 8, border: "none",
                background: "#1a73e8", color: "#fff",
                cursor: "pointer", fontSize: 14, fontWeight: 600,
              }}
            >
              Create your first alert
            </button>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <section style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: "#80868b", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>
                  Active · {active.length}
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {active.map((a) => <AlertCard key={a.id} alert={a} onToggle={handleToggle} onDelete={handleDelete} />)}
                </div>
              </section>
            )}

            {paused.length > 0 && (
              <section style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: "#80868b", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>
                  Paused · {paused.length}
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {paused.map((a) => <AlertCard key={a.id} alert={a} onToggle={handleToggle} onDelete={handleDelete} />)}
                </div>
              </section>
            )}

            {done.length > 0 && (
              <section>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: "#80868b", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>
                  Completed · {done.length}
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {done.map((a) => <AlertCard key={a.id} alert={a} onToggle={handleToggle} onDelete={handleDelete} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {showModal && <CreateAlertModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
    </div>
  );
}
