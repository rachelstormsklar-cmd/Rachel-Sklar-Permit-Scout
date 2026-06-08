# Permit Scout — Backend Scanner

Polls Recreation.gov every 15 minutes and texts you the moment a wilderness permit opens.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `RIDB_API_KEY` | [ridb.recreation.gov](https://ridb.recreation.gov/) — free |
| `TWILIO_ACCOUNT_SID` | [Twilio Console](https://console.twilio.com) |
| `TWILIO_AUTH_TOKEN` | Twilio Console |
| `TWILIO_FROM_NUMBER` | A Twilio phone number you own |

### 3. Run locally

```bash
# Scanner only (checks every 15 min, runs forever)
npm start

# REST API only (so the frontend can create/manage alerts)
npm run api

# Both at once
npm run start:all
```

---

## Deployment (free tier, 24/7)

### Railway (recommended — easiest)
1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add your `.env` variables in the Railway dashboard under Variables
4. Done — Railway runs `npm start` automatically

### Render
1. New Web Service → connect your repo
2. Build command: `npm install`
3. Start command: `npm run start:all`
4. Add env vars in the Render dashboard

### Fly.io
```bash
fly launch
fly secrets set RIDB_API_KEY=xxx TWILIO_ACCOUNT_SID=xxx ...
fly deploy
```

---

## REST API

The API server (`api.js`) lets the React frontend manage alerts.

### Create an alert
```bash
curl -X POST http://localhost:3001/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "yosemite_wilderness",
    "zoneId": "mcgurk_dewey",
    "dates": ["2026-08-01", "2026-08-02", "2026-08-08"],
    "groupSize": 2,
    "phone": "+15105550100"
  }'
```

### List all alerts
```bash
curl http://localhost:3001/api/alerts
```

### Pause an alert
```bash
curl -X PATCH http://localhost:3001/api/alerts/{id} \
  -H "Content-Type: application/json" \
  -d '{"status": "paused"}'
```

### Delete an alert
```bash
curl -X DELETE http://localhost:3001/api/alerts/{id}
```

---

## Supported Locations

| Location | `locationId` | Recreation.gov Facility ID |
|---|---|---|
| Yosemite Wilderness | `yosemite_wilderness` | 232447 |
| John Muir Trail | `john_muir` | 233261 |
| Mount Whitney | `mount_whitney` | 233260 |
| Desolation Wilderness | `desolation_wilderness` | 445856 |

To add more locations, find the facility ID on Recreation.gov (it's in the URL of the permit page) and add it to `FACILITY_IDS` in `api.js` and the `LOCATIONS` map in `scanner.js`.

---

## How it works

```
Every 15 minutes:
  For each active alert:
    For each watched date:
      → Query Recreation.gov availability API
      → If slots >= groupSize AND not yet notified:
          → Send SMS via Twilio with direct booking link
          → Mark date as notified (won't text again)
```

Notifications are tracked in SQLite so you only ever get **one text per date** — no spam if the permit briefly appears and disappears.

---

## File structure

```
permit-scanner/
├── scanner.js        # Main cron loop — runs the scans
├── api.js            # Express REST API for the frontend
├── db.js             # SQLite database layer
├── recreation-gov.js # Recreation.gov API client
├── twilio.js         # Twilio SMS sender
├── logger.js         # Timestamped console logger
├── package.json
├── .env.example      # Copy to .env and fill in credentials
└── README.md
```
