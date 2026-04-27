# InkSentinel — Complete Project Documentation

> Digital exam proctoring system — CSE299 project  
> North South University, Dhaka  
> Backend: MARS | Hardware/Pen: Shams | AI/ML: AI Friend | Frontend: Frontend Friend

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
   - 2.1 System Architecture
   - 2.2 Network Architecture
   - 2.3 Database Schema
   - 2.4 WebSocket Data Flow
   - 2.5 Inference Pipeline
   - 2.6 Session Lifecycle
3. [Setup & Installation](#3-setup--installation)
4. [Running on Another Machine](#4-running-on-another-machine)
5. [Environment Variables](#5-environment-variables)
6. [Source Code — Backend](#6-source-code--backend)
7. [Source Code — Frontend](#7-source-code--frontend)
8. [Source Code — Python Inference Server](#8-source-code--python-inference-server)
9. [Hardware — ESP32 Patch Notes](#9-hardware--esp32-patch-notes)
10. [Test Cases](#10-test-cases)
11. [Known Issues & QoL Tasks](#11-known-issues--qol-tasks)
12. [Feature Roadmap](#12-feature-roadmap)
13. [Instructor Notes & Decisions](#13-instructor-notes--decisions)

---

## 1. Project Overview

InkSentinel is a digital exam proctoring system that:

- Streams webcam feeds from exam seats to a proctor dashboard over WebSocket
- Runs YOLOv8 object detection on frames to flag cheating behaviour (phone, cheatsheet, etc.)
- Saves 30-second alert clips around detected events using ffmpeg
- Controls smart pen devices (Proctopen) over BLE/WiFi through a central ESP32
- Tracks exam sessions with attendance, per-seat detections, and signal history

**Stack:**
- Backend: Node.js 18+, Express 5, `ws`, `serialport`
- Database: PostgreSQL 15
- AI: YOLOv8 (ultralytics) served via Python Flask
- Hardware: ESP32 central unit, Wemos D1 Mini pen units
- Frontend: Plain HTML/CSS/JS (no framework)

---

## 2. Architecture

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MARS's Laptop                            │
│                                                                  │
│  ┌──────────────┐   ┌───────────────┐   ┌───────────────────┐  │
│  │  PostgreSQL  │   │  Node.js :3000│   │  Python Flask     │  │
│  │  (DB)        │◄──│  Express + WS │──►│  :9999 (YOLO)    │  │
│  └──────────────┘   └───────┬───────┘   └───────────────────┘  │
│                             │                                    │
│                      USB Serial (COM3)                           │
│                             │                                    │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  ESP32 Central     │
                    │  (Proctopen)       │
                    │  AP: 192.168.4.x  │
                    └─────────┬─────────┘
                              │ TCP :8080
               ┌──────────────┼──────────────┐
               │              │              │
        ┌──────▼──┐    ┌──────▼──┐    ┌──────▼──┐
        │ Wemos   │    │ Wemos   │    │ Wemos   │
        │ Pen 1   │    │ Pen 2   │    │ Pen 3   │
        └─────────┘    └─────────┘    └─────────┘

External devices (connected to hotspot / LAN):
  ┌─────────────────┐   ┌─────────────────┐
  │  Camera Device  │   │  Proctor Device │
  │  /camera page   │   │  /pen page      │
  │  (WS feed)      │   │  (BLE or WiFi)  │
  └─────────────────┘   └─────────────────┘
```

### 2.2 Network Architecture

```
Phone/Router Hotspot (e.g. 192.168.43.0/24)
│
├── MARS's Laptop        192.168.43.X  (Node.js :3000, YOLO :9999, Postgres :5432)
├── Camera Device 1      192.168.43.X  → http://192.168.43.X:3000/camera
├── Camera Device 2      192.168.43.X  → http://192.168.43.X:3000/camera
└── Proctor Phone        192.168.43.X  → http://192.168.43.X:3000/pen

ESP32 USB → MARS's Laptop COM3  (serial commands only, not on WiFi)
ESP32 AP  → Proctopen 192.168.4.x  (pen units only, isolated subnet)
```

**Decision rationale:** ESP32 is connected via USB serial rather than WiFi to avoid the two-network problem (camera LAN vs Proctopen AP). Serial is more reliable for a demo — no IP to guess, no reconnection race condition.

### 2.3 Database Schema

```
┌─────────────────────────────────────────────────────────────────┐
│  exam_sessions                                                   │
│  ─────────────                                                   │
│  id SERIAL PK                                                    │
│  name TEXT             ← filesystem-safe, used as folder name   │
│  course_name TEXT                                                │
│  instructor_name TEXT                                            │
│  time_block TEXT                                                 │
│  created_at TIMESTAMPTZ                                          │
│  ended_at TIMESTAMPTZ  ← NULL = active                          │
└──────────────────┬──────────────────────────────────────────────┘
                   │ 1:N (SET NULL on delete)
     ┌─────────────┼──────────────────────────────┐
     │             │                              │
┌────▼────┐  ┌─────▼──────┐  ┌────────────┐  ┌──▼──────────┐
│ feeds   │  │ detections │  │ video_segs │  │  signals    │
│ ─────── │  │ ─────────── │  │ ─────────── │  │  ──────────  │
│ id PK   │  │ id PK       │  │ id PK       │  │ id PK        │
│ label   │  │ session_id  │  │ session_id  │  │ session_id   │
│ client  │  │ feed_id FK  │  │ feed_id FK  │  │ feed_id FK   │
│ connected│ │ detected_at │  │ file_path   │  │ signal TEXT  │
│ deleted_at│ │ class_label │  │ started_at  │  │ params JSONB │
│ created_at│ │ confidence  │  │ ended_at    │  │ sent_at      │
└────┬────┘  │ alert_clip  │  │ size_bytes  │  │ sent_by      │
     │       └─────────────┘  └─────────────┘  └─────────────┘
     │ 1:N
┌────▼────────────┐
│ session_feeds   │  ← attendance table
│ ──────────────── │
│ id PK            │
│ session_id FK    │
│ feed_id FK       │
│ feed_label TEXT  │  ← denormalized label at time of connection
│ candidate_name   │  ← filled by instructor (optional)
│ connected_at     │
│ UNIQUE(session,feed)│
└──────────────────┘

Key design decisions:
  - ON DELETE SET NULL (not CASCADE): detections survive feed removal
  - feeds.deleted_at: soft delete — card removed from dashboard,
    row kept for historical joins
  - session_feeds: attendance tracking, populated by wsHandler on
    camera connect, supports editable candidate names
  - signals.sent_by: 'admin' = candidate page, 'pen_app' = Proctopen
```

### 2.4 WebSocket Data Flow

```
camera.html                  Node.js wsHandler              Dashboard
    │                              │                             │
    │── WS connect ?role=feed ────►│                             │
    │                              │── feed_connected JSON ─────►│
    │                              │                             │
    │── binary JPEG frame ────────►│                             │
    │                              │── binary (feedId+JPEG) ────►│
    │                              │── detection JSON ───────────►│
    │                              │                             │
    │                              │ [if throttle passes]        │
    │                              │── POST /infer (JPEG) ──►Flask│
    │                              │◄── {detections, annotated} ──│
    │                              │                             │
    │                    [if cheating confirmed after 3s]        │
    │                              │── INSERT detections         │
    │                              │── ffmpeg alert clip         │
    │                              │── UPDATE alert_clip_path    │
    │                              │                             │
    │◄── detection ACK JSON ───────│                             │
    │  (updates LED state)         │── annotated frame ─────────►│
```

### 2.5 Inference Pipeline

```
Frame arrives at wsHandler
        │
        ▼
isProcessing? ──YES──► DROP (prevents queue backlog)
        │NO
        ▼
lastProcessedTime + SAMPLE_INTERVAL_MS > now? ──YES──► SKIP
        │NO
        ▼
isProcessing = true
        │
        ▼
POST /infer (raw JPEG bytes)
        │
        ▼
Flask server (best.pt, CPU)
        │
        ├── confidence < 0.3? ── FILTER OUT
        │
        ▼
Returns JSON {detection_count, detections[], annotated_image (base64)}
        │
        ▼
updateDetectionState()
        │
        ├── isSuspicious? ── NO ─► reset cheat timer
        │         │YES
        │         ▼
        │   cheatStartTime = now (if not already set)
        │         │
        │   elapsed >= CHEAT_THRESHOLD_MS (3s)?
        │         │YES, alertFired=false?
        │         ▼
        │   alertTriggered = true ──► save alert clip
        │                        ──► INSERT detection to DB
        │
        ▼
isProcessing = false

CHEATING_CLASSES = {phone, cheatsheet, looking_away, cheating}
Also triggers if >1 person detected in frame
```

### 2.6 Session Lifecycle

```
Instructor clicks "+ New Session"
        │
        ▼
POST /api/sessions
        │
        ├── UPDATE exam_sessions SET ended_at=NOW() (end any active)
        ├── UPDATE feeds SET deleted_at=NOW() (clear dashboard)
        └── INSERT exam_sessions (name, course, instructor, time)
                │
                ▼
        Node.js holds active session in getActiveSession()
        (DB query every time — no in-memory cache)
                │
Camera connects → wsHandler
        │
        ├── getOrCreateFeed() — upsert into feeds
        ├── getActiveSession() — get current session
        ├── INSERT session_feeds (attendance record)
        └── FeedRecorder(feedId, label, sessionName, sessionId)
              └── creates recordings/<sessionName>/<seatLabel>/

Detection fires → wsHandler
        │
        └── INSERT detections (session_id, feed_id, ...)

Signal sent → signals.js / penlog.js
        │
        └── INSERT signals (session_id, ...)

Instructor clicks "End Session"
        │
        └── UPDATE exam_sessions SET ended_at=NOW()

Next session start resets the cycle.
```

---

## 3. Setup & Installation

### Prerequisites

| Software | Version | Notes |
|----------|---------|-------|
| Node.js | 18+ | Required for native fetch, ES modules |
| PostgreSQL | 15+ | Must be running before Node starts |
| Python | 3.9+ | For YOLO inference server |
| ffmpeg | Any recent | Must be on PATH |
| Arduino IDE | 2.x | For ESP32 firmware upload |

### Step 1 — Clone and install Node dependencies

```bash
git clone https://github.com/iTS-AMS/inksentinel
cd inksentinel/backend
npm install
```

### Step 2 — Create PostgreSQL database

Open pgAdmin → right-click Databases → Create → name it `surveillance`.  
Then open Query Tool and run `schema_v3.sql` (full schema with sessions).  
Then run `schema_v4_migration.sql` (adds session_feeds attendance table).

### Step 3 — Configure environment

Copy `.env.template` to `.env` and fill in:

```
PG_PASSWORD=your_postgres_password
ESP32_SERIAL_PORT=COM3         # check Device Manager → Ports when ESP32 plugged in
```

All other values can stay as defaults for local testing.

### Step 4 — Install Python dependencies

```bash
pip install ultralytics flask flask-cors pillow numpy
```

Place `best.pt` in the same folder as `server.py`.

### Step 5 — Upload ESP32 firmware

Open `esp32_central_v4.ino` in Arduino IDE. Add the serial patch (two changes — see Section 9). Upload to ESP32 DevKitV1.

---

## 4. Running on Another Machine

### Full startup sequence

```bash
# Terminal 1 — YOLO inference server (run from folder containing best.pt)
python server.py
# Expected: "Model classes: {0: 'cheating', ...}" + "Running on http://0.0.0.0:9999"

# Terminal 2 — Node.js backend
cd inksentinel/backend
node src/index.js
# Expected output:
#   [Server] HTTP mode
#   Server running at http://localhost:3000
#   [Server] Accessible on network: http://192.168.X.X:3000
#   DB connected at: ...
#   [DB] Reset all feeds to connected=false
#   [WS] WebSocket server ready on /ws
#   [Inference] YOLO API reachable ✓ — classes: cheating, phone, ...
#   [Signal] Route loaded — getActiveSession import: OK
```

### Network setup for demo

1. Create a phone/laptop hotspot (e.g. `InkSentinel`, password `inksentinel123`)
2. Connect MARS's laptop (running backend) to the hotspot
3. Note the laptop's IP on the hotspot (run `ipconfig` on Windows, `ip addr` on Linux)
4. Connect camera devices to same hotspot
5. Open `http://<LAPTOP_IP>:3000/camera` on each camera device
6. Plug ESP32 into laptop USB → check COM port → update `.env`

### First-time run checklist

```
[ ] PostgreSQL service running
[ ] surveillance database exists with both schema files applied
[ ] .env has correct PG_PASSWORD and ESP32_SERIAL_PORT
[ ] python server.py running — shows model classes on startup
[ ] node src/index.js running — shows all 4 startup lines
[ ] http://localhost:3000/login loads
[ ] Login with admin / proctor123
[ ] /allsessions → click "+ New Session" to create first session
[ ] Open /camera on another device → enter seat label → START CAMERA
[ ] Dashboard shows LIVE badge on the feed card
```

---

## 5. Environment Variables

```env
PORT=3000

# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=surveillance
PG_USER=postgres
PG_PASSWORD=your_pass

# Auth
JWT_SECRET=proctor_secret_key_change_this_later
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$10$Dn6N9vVxLkE.QQyGxw5XjudamUxMu2KkBeCdxRa1VKxTcpTAbm44C
# password: proctor123

# ESP32 via USB serial
# Windows: check Device Manager > Ports (COM & LPT) when ESP32 plugged in
# Linux: /dev/ttyUSB0 or /dev/ttyACM0
ESP32_SERIAL_PORT=COM3

VIDEO_DIR=./recordings

# YOLO inference
YOLO_API_URL=http://localhost:9999       # or ngrok URL for Colab
YOLO_TIMEOUT_MS=4000                     # abort inference call after 4s
YOLO_SAMPLE_MS=300                       # ~3fps sent to YOLO (safe for CPU)
CHEAT_THRESHOLD_MS=3000                  # 3s of suspicious activity → alert
RING_BUFFER_SEC=30                       # seconds of frames kept in memory
FORCE_RAW_STREAM=false                   # true = skip annotated frames (debug)

USE_HTTPS=false
```

---

## 6. Source Code — Backend

### 6.1 src/index.js

```javascript
import 'dotenv/config';
import express      from 'express';
import cookieParser from 'cookie-parser';
import path         from 'path';
import http         from 'http';
import https        from 'https';
import fs           from 'fs';
import { fileURLToPath } from 'url';

import { testConnection, resetAllConnected } from './db.js';
import authRoutes     from './routes/auth.js';
import feedRoutes     from './routes/feeds.js';
import incidentRoutes from './routes/incidents.js';
import statsRoutes    from './routes/stats.js';
import signalRoutes   from './routes/signals.js';
import penlogRoutes   from './routes/penlog.js';
import historyRoutes  from './routes/history.js';
import sessionRoutes  from './routes/sessions.js';
import pageRouter     from './pages/router.js';
import { setupWebSocket } from './wsHandler.js';

const app  = express();
const PORT = process.env.PORT || 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC    = path.join(__dirname, '..', 'public');

app.use(express.json());
app.use(cookieParser());
app.use(express.static(PUBLIC));

app.use('/',               pageRouter);
app.use('/api/feeds',      feedRoutes);
app.use('/api/incidents',  incidentRoutes);
app.use('/api/stats',      statsRoutes);
app.use('/api/auth',       authRoutes);
app.use('/api/signal',     signalRoutes);
app.use('/api/penlog',     penlogRoutes);
app.use('/api/history',    historyRoutes);
app.use('/api/sessions',   sessionRoutes);

let server;
if (process.env.USE_HTTPS === 'true') {
  const sslOptions = {
    cert: fs.readFileSync(process.env.SSL_CERT || './cert.pem'),
    key:  fs.readFileSync(process.env.SSL_KEY  || './key.pem'),
  };
  server = https.createServer(sslOptions, app);
  console.log('[Server] HTTPS mode');
} else {
  server = http.createServer(app);
  console.log('[Server] HTTP mode');
}

setupWebSocket(server);

const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  const proto = process.env.USE_HTTPS === 'true' ? 'https' : 'http';
  console.log(`Server running at ${proto}://localhost:${PORT}`);
});

testConnection();
resetAllConnected();
```

### 6.2 src/db.js

```javascript
// src/db.js
// PostgreSQL connection pool + shared query helpers.
// All routes import query() and getActiveSession() from here.
import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';

const pool = new pg.Pool({
  host:     process.env.PG_HOST,
  port:     Number(process.env.PG_PORT),
  database: process.env.PG_DATABASE,
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

pool.on('error', (err) => {
  console.error('Unexpected DB error:', err.message);
});

export async function testConnection() {
  const result = await pool.query('SELECT NOW() AS time');
  console.log('DB connected at:', result.rows[0].time);
}

export async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result;
}

export default pool;

// Atomic upsert — prevents race condition on simultaneous camera connects.
// ON CONFLICT ensures a second camera with the same label/IP doesn't
// create a duplicate feed row.
export async function getOrCreateFeed(clientId, label) {
  const result = await query(
    `INSERT INTO feeds (label, client_id, connected)
     VALUES ($1, $2, true)
     ON CONFLICT (client_id)
     DO UPDATE SET label = EXCLUDED.label, connected = true, deleted_at = NULL
     RETURNING *`,
    [label, clientId]
  );
  return result.rows[0];
}

// Returns the currently active exam session, or null if none started.
// Called by wsHandler, signals.js, penlog.js to write session_id on inserts.
export async function getActiveSession() {
  const result = await query(
    `SELECT * FROM exam_sessions WHERE ended_at IS NULL ORDER BY created_at DESC LIMIT 1`
  );
  return result.rows[0] || null;
}

export async function resetAllConnected() {
  await query('UPDATE feeds SET connected = false');
  console.log('[DB] Reset all feeds to connected=false');
}
```

### 6.3 src/wsHandler.js  *(latest: v4)*

> See file `wsHandler_v4.js` in outputs. Full inline comments included in that version.
> Key responsibilities:
> - Manages feed connections and dashboard client connections
> - Routes binary JPEG frames from cameras to dashboards
> - Runs YOLO inference pipeline with state machine (3s threshold)
> - Writes attendance to session_feeds on camera connect
> - Writes detections with session_id
> - Saves alert clips via ffmpeg

### 6.4 src/recorder.js  *(latest: v3)*

> See file `recorder_v3.js` in outputs.
> Key responsibilities:
> - Opens ffmpeg process per feed for continuous MP4 segmentation (10 min each)
> - Uses session name as top-level folder: `recordings/<session>/<seat>/`
> - `flushAlertClip()` writes ring buffer frames to 30s alert clip

### 6.5 src/inferenceClient.js  *(merged version)*

```javascript
// src/inferenceClient.js
// HTTP client for YOLO Flask server.
// Single POST /infer endpoint — returns JSON + base64 annotated frame.
// Throttle/sampling is handled in wsHandler via isProcessing flag.
import 'dotenv/config';

const YOLO_BASE  = process.env.YOLO_API_URL || 'http://localhost:9999';
const INFER_URL  = `${YOLO_BASE}/infer`;
const TIMEOUT_MS = process.env.YOLO_TIMEOUT_MS
  ? Number(process.env.YOLO_TIMEOUT_MS)
  : 4000;

export async function runInference(jpegBuffer) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(INFER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body:    jpegBuffer,
      signal:  controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`YOLO API returned ${response.status}: ${text}`);
    }

    const json = await response.json();

    let annotatedFrame = null;
    if (json.annotated_image) {
      annotatedFrame = Buffer.from(json.annotated_image, 'base64');
    }

    return {
      ok:              true,
      detections:      json.detections      ?? [],
      detection_count: json.detection_count ?? 0,
      annotatedFrame,
      error:           null,
    };

  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    const msg       = isTimeout
      ? `YOLO inference timed out after ${TIMEOUT_MS}ms`
      : `YOLO inference error: ${err.message}`;
    console.warn(`[Inference] ${msg}`);
    return { ok: false, detections: [], detection_count: 0, annotatedFrame: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkYoloHealth() {
  try {
    const res = await fetch(`${YOLO_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      console.log(`[Inference] YOLO API reachable ✓ — classes: ${Object.values(data.classes).join(', ')}`);
      return true;
    }
  } catch (_) {}
  console.warn('[Inference] YOLO API NOT reachable — inference disabled until it comes up');
  return false;
}
```

### 6.6 src/middleware/auth.js

```javascript
// src/middleware/auth.js
// JWT cookie verification middleware.
// Two exports:
//   requireAuth    — for page routes, redirects to /login on failure
//   requireAuthApi — for API routes, returns 401 JSON on failure
import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.redirect('/login');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.clearCookie('token');
    res.redirect('/login');
  }
}

export function requireAuthApi(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.clearCookie('token');
    res.status(401).json({ error: 'Session expired' });
  }
}
```

### 6.7 src/routes/auth.js

```javascript
// src/routes/auth.js
// POST /api/auth/login  — bcrypt verify, sign JWT, set httpOnly cookie
// POST /api/auth/logout — clear cookie
import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { Router } from 'express';
import jwt        from 'jsonwebtoken';
import bcrypt     from 'bcryptjs';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || username !== process.env.ADMIN_USERNAME)
    return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, process.env.ADMIN_PASSWORD_HASH);
  if (!valid)
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { username, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.cookie('token', token, { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 });
  res.json({ success: true, redirect: '/dashboard' });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, redirect: '/login' });
});

export default router;
```

### 6.8 src/routes/feeds.js  *(soft-delete version)*

> See `feeds_softdelete.js` in outputs.
> Key: DELETE uses `UPDATE feeds SET deleted_at = NOW()` not hard DELETE.
> GET only returns feeds WHERE `deleted_at IS NULL`.

### 6.9 src/routes/stats.js  *(latest: v6)*

> See `stats_v6.js` in outputs.
> Key: three-tier byFeed source: session_feeds → detections → current feeds.
> Prevents historical session showing wrong seat data.

### 6.10 src/routes/signals.js  *(latest: v5)*

> See `signals_v5.js` in outputs.
> Key fixes: writes session_id, serial port flush() on open prevents replay.

### 6.11 src/routes/penlog.js  *(latest: v4)*

> See `penlog_v4.js` in outputs.
> Key: writes session_id so pen app signals appear in signal history with session name.

### 6.12 src/routes/incidents.js

```javascript
// src/routes/incidents.js
// GET /api/incidents — returns detections with session and feed labels.
// Supports ?sessionId=N, ?feedId=N, ?classLabel=X filters.
import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

router.get('/', async (req, res) => {
  const { feedId, classLabel, sessionId } = req.query;

  let sql = `
    SELECT
      d.*,
      f.label         AS feed_label,
      s.name          AS session_name
    FROM detections d
    LEFT JOIN feeds         f ON f.id = d.feed_id
    LEFT JOIN exam_sessions s ON s.id = d.session_id
    WHERE 1=1
  `;
  const params = [];

  if (sessionId) {
    params.push(parseInt(sessionId));
    sql += ` AND d.session_id = $${params.length}`;
  }
  if (feedId && feedId !== 'all') {
    params.push(parseInt(feedId));
    sql += ` AND d.feed_id = $${params.length}`;
  }
  if (classLabel && classLabel !== 'all') {
    params.push(classLabel);
    sql += ` AND d.class_label = $${params.length}`;
  }

  sql += ' ORDER BY d.detected_at DESC';

  try {
    const result = await query(sql, params);
    res.json({ incidents: result.rows });
  } catch (err) {
    console.error('[Incidents]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
```

### 6.13 src/routes/history.js

```javascript
// src/routes/history.js
// GET    /api/history — signals with session name join
// DELETE /api/history — clear by source or all
// Supports ?sessionId=N, ?source=X, ?cmd=X, ?date=YYYY-MM-DD
import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

router.get('/', async (req, res) => {
  const { source, cmd, date, sessionId } = req.query;

  let sql = `
    SELECT
      sg.id,
      sg.signal   AS cmd,
      sg.params,
      sg.sent_at  AS ts,
      sg.sent_by,
      s.name      AS session_name
    FROM signals sg
    LEFT JOIN exam_sessions s ON s.id = sg.session_id
    WHERE 1=1
  `;
  const vals = [];

  if (sessionId) { vals.push(parseInt(sessionId)); sql += ` AND sg.session_id = $${vals.length}`; }
  if (source && source !== 'all') { vals.push(source); sql += ` AND sg.sent_by = $${vals.length}`; }
  if (cmd && cmd !== 'all') { vals.push(cmd); sql += ` AND sg.signal = $${vals.length}`; }
  if (date) { vals.push(date); sql += ` AND sg.sent_at::date = $${vals.length}`; }

  sql += ' ORDER BY sg.sent_at DESC';

  try {
    const result = await query(sql, vals);
    const entries = result.rows.map(r => ({
      id:           r.id,
      cmd:          r.cmd,
      ts:           r.ts,
      sent_by:      r.sent_by,
      session_name: r.session_name,
      params: typeof r.params === 'string'
        ? JSON.parse(r.params || '{}') : (r.params || {}),
    }));
    res.json({ entries });
  } catch (err) {
    console.error('[History]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/', async (req, res) => {
  const { source } = req.query;
  try {
    if (source && source !== 'all')
      await query('DELETE FROM signals WHERE sent_by = $1', [source]);
    else
      await query('DELETE FROM signals');
    res.json({ cleared: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
```

### 6.14 src/routes/sessions.js  *(latest: v4)*

> See `sessions_route_v4.js` in outputs.
> Endpoints: GET /, GET /active, GET /:id/attendance, PATCH /:id/attendance/:sfId, POST /, PUT /:id/end

### 6.15 src/pages/router.js

```javascript
// src/pages/router.js
// Serves HTML pages with JWT cookie auth.
// requireAuth redirects to /login on failure.
// /sessions redirects to /allsessions (renamed route).
import 'dotenv/config';
import { Router } from 'express';
import path       from 'path';
import { fileURLToPath } from 'url';
import jwt        from 'jsonwebtoken';
import { requireAuth } from '../middleware/auth.js';

const router    = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC    = path.join(__dirname, '..', '..', 'public');
const page      = (name) => path.join(PUBLIC, `${name}.html`);

router.get('/',              requireAuth, (req, res) => res.redirect('/dashboard'));
router.get('/login', (req, res) => {
  try { jwt.verify(req.cookies?.token, process.env.JWT_SECRET); res.redirect('/dashboard'); }
  catch { res.sendFile(page('login')); }
});
router.get('/dashboard',     requireAuth, (req, res) => res.sendFile(page('dashboard')));
router.get('/session',       requireAuth, (req, res) => res.sendFile(page('session')));
router.get('/incidents',     requireAuth, (req, res) => res.sendFile(page('incidents')));
router.get('/candidate/:id', requireAuth, (req, res) => res.sendFile(page('candidate')));
router.get('/camera',        requireAuth, (req, res) => res.sendFile(page('camera')));
router.get('/history',       requireAuth, (req, res) => res.sendFile(page('history')));
router.get('/sessions',      requireAuth, (req, res) => res.redirect('/allsessions'));
router.get('/allsessions',   requireAuth, (req, res) => res.sendFile(page('allsessions')));
router.get('/pen',           requireAuth, (req, res) =>
  res.sendFile(path.join(PUBLIC, 'penapp', 'index.html'))
);

export default router;
```

---

## 7. Source Code — Frontend

### Frontend file map

| Page URL | File | Purpose |
|----------|------|---------|
| `/login` | `public/login.html` | Auth form |
| `/dashboard` | `public/dashboard.html` | Live feed cards |
| `/candidate/:id` | `public/candidate.html` | Per-seat view + per-seat signals |
| `/session` | `public/session.html` | Stats, charts, attendance register |
| `/allsessions` | `public/allsessions.html` | Session list + new session modal |
| `/incidents` | `public/incidents.html` | Detection log table |
| `/history` | `public/history.html` | Signal history table |
| `/camera` | `public/camera.html` | Camera device page (LED + stream) |
| `/pen` | `public/penapp/index.html` | Proctopen pen control (with sidebar) |
| — | `public/js/nav.js` | Sidebar builder + `api()` helper |
| — | `public/css/style.css` | Global styles |

### 7.1 public/js/nav.js  *(latest: v3)*

> See `nav_v3.js` in outputs.
> Builds sidebar with collapse/expand, persists state in localStorage.
> Exports `buildSidebar()`, `initSidebar()`, `api()`, `logout()`.

### 7.2 Sidebar usage pattern

Every page with a sidebar must call both lines:
```javascript
document.getElementById('sidebar').innerHTML = buildSidebar();
initSidebar(); // restores collapse state from localStorage
```

Every `<div id="sidebar">` must have inline style to prevent layout jump:
```html
<div id="sidebar" style="min-width:200px;width:200px;flex-shrink:0"></div>
```

### 7.3 Sticky sidebar CSS rule  *(add to bottom of style.css)*

```css
/* Sticky sidebar — must match these exact rules or it won't stick */
html, body { height: 100%; overflow: auto; }
.layout    { display: flex; min-height: 100vh; align-items: flex-start; }
.main      { flex: 1; padding: 28px 30px; min-width: 0; }
.sidebar   { position: sticky; top: 0; height: 100vh; overflow-y: auto; flex-shrink: 0; }
```

### 7.4 Key frontend pages

**session.html (v6):** reads `?id=N` from URL to show historical sessions.
Calls `clearAllSections()` immediately before API loads to prevent stale display.
Auto-refresh only for active (non-historical) sessions.

**allsessions.html:** search bar filters rows client-side.
Row onclick passes `window.location='/session?id=${s.id}'` — this is the fix for the "all 0" bug.

**history.html (v6):** date picker filters session dropdown to sessions active on that date.
"Hide Shown" stores signal IDs in `localStorage['history-hidden']` — no DB changes.
Legacy signals (null session_id) shown as "legacy" in amber.

**camera.html (multicam):** dropdown lists all webcam devices by deviceId.
Locks to selected device via `getUserMedia({ deviceId: { exact: selectedId } })`.

---

## 8. Source Code — Python Inference Server

### server.py

```python
# server.py — YOLO inference server
# Run from folder containing best.pt:  python server.py
# Single endpoint: POST /infer
#   Body:    raw JPEG bytes (Content-Type: image/jpeg)
#   Returns: JSON { detection_count, detections[], annotated_image (base64 or null) }
# GET /health → {"status": "ok", "classes": {...}}

import io, base64
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import numpy as np
from ultralytics import YOLO

CONFIDENCE_THRESHOLD = 0.3   # matches why.py threshold
model = YOLO("best.pt")      # custom trained model
app   = Flask(__name__)
CORS(app)

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "classes": model.names})

@app.route("/infer", methods=["POST"])
def infer():
    raw = request.get_data()
    if not raw:
        return jsonify({"error": "empty body"}), 400

    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as e:
        return jsonify({"error": f"invalid image: {e}"}), 400

    results = model(image, verbose=False)[0]

    detections = []
    for box in results.boxes:
        conf = float(box.conf[0])
        if conf < CONFIDENCE_THRESHOLD:
            continue
        cls_id = int(box.cls[0])
        detections.append({
            "class":      model.names[cls_id],
            "confidence": round(conf, 4),
        })

    # Only annotate when detections exist — saves CPU on clean frames
    annotated_b64 = None
    if detections:
        np_img        = np.array(image)
        annotated_np  = results.plot()
        annotated_pil = Image.fromarray(annotated_np[..., ::-1])
        buf           = io.BytesIO()
        annotated_pil.save(buf, format="JPEG", quality=85)
        annotated_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return jsonify({
        "detection_count": len(detections),
        "detections":      detections,
        "annotated_image": annotated_b64,
    })

if __name__ == "__main__":
    print("Model classes:", model.names)
    app.run(host="0.0.0.0", port=9999, threaded=True)
```

---

## 9. Hardware — ESP32 Patch Notes

### Two changes required in `esp32_central_v4.ino`

**Change 1:** Add the function above `handleWebCommand()`:

```cpp
// Declare in forward declarations block (near top of file):
void readSerialCommands();

// ── Serial command reader ─────────────────────────────────────
// Reads newline-terminated JSON from USB serial and passes to
// handleWebCommand() — same handler used by BLE and WiFi WS.
static String serialBuf = "";

void readSerialCommands() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      serialBuf.trim();
      if (serialBuf.length() > 0) {
        Serial.print("[Serial] Received: ");
        Serial.println(serialBuf);
        handleWebCommand(serialBuf);
      }
      serialBuf = "";
    } else if (c != '\r') {
      serialBuf += c;
    }
  }
}
```

**Change 2:** In `loop()`, add one call after `checkButton()`:

```cpp
checkButton();
readSerialCommands();   // ← add this line
```

**Verify:** Open Arduino Serial Monitor at 115200 baud. Send a signal from the candidate page. You should see:
```
[Serial] Received: {"cmd":"start"}
Web cmd: {"cmd":"start"}
```

---

## 10. Test Cases

### A. Auth

| # | Test | Action | Expected |
|---|------|--------|---------|
| A1 | Login page loads | Navigate to `/login` | Login panel visible |
| A2 | Wrong credentials | Enter wrong password | Red error box |
| A3 | Correct login | admin / proctor123 | Redirect to `/dashboard` |
| A4 | Already logged in | Visit `/login` | Auto-redirect to `/dashboard` |
| A5 | Logout | Click Sign out | Redirected to `/login`, cookie cleared |
| A6 | Protected route no auth | Log out, visit `/dashboard` directly | Redirect to `/login` |

### B. Dashboard

| # | Test | Expected |
|---|------|---------|
| B1 | Feed cards render | Seats shown from DB |
| B2 | Offline badge | Grey card, OFFLINE badge |
| B3 | Filter Live | Only connected feeds shown |
| B4 | Filter Alerts | Only flagged feeds shown |
| B5 | Card links to candidate | Click card → `/candidate/:id` |
| B6 | Remove connected feed | Error: "Cannot remove a connected feed" |
| B7 | Remove offline feed | Feed disappears (soft-deleted) |
| B8 | Session banner visible | Shows active session name + course |
| B9 | Sidebar collapse | Shrinks to 52px icon strip |
| B10 | Collapse persists | Navigate to another page — still collapsed |

### C. Camera

| # | Test | Expected |
|---|------|---------|
| C1 | Camera selector populated | Dropdown shows all webcam devices |
| C2 | Connect specific camera | Selected camera only (not default) |
| C3 | Feed goes LIVE on dashboard | Card badge turns green |
| C4 | YOLO detection | Phone in frame → LED turns red |
| C5 | Disconnect button | Webcam stops, LED wrap hidden, dashboard goes OFFLINE |
| C6 | Auto-reconnect | Restart Node → camera reconnects within 3s |

### D. Session

| # | Test | Expected |
|---|------|---------|
| D1 | No active session | Warning banner, zeros in KPIs |
| D2 | Create new session | Modal fields → `/session?id=N` |
| D3 | Historical session via URL | `/session?id=1` shows session 1 data |
| D4 | Historical shows correct seats | Seats from that session, not current |
| D5 | Attendance register | Seats appear after camera connects |
| D6 | Edit candidate name | Click field, type, press Enter → saved |
| D7 | End session | Confirm → banner updates, KPIs clear |
| D8 | No auto-refresh on historical | Ended session does not poll every 10s |

### E. All Sessions

| # | Test | Expected |
|---|------|---------|
| E1 | Session list loads | All sessions newest-first |
| E2 | Search filters rows | Typing "CSE" filters to matching sessions |
| E3 | Click row → correct session | `/session?id=N` shows that session's data |
| E4 | Active session has green dot | Only ended sessions show ENDED badge |
| E5 | New session soft-deletes feeds | Dashboard clears after creation |

### F. Incidents

| # | Test | Expected |
|---|------|---------|
| F1 | All incidents load | Table populated |
| F2 | Filter by session | Only that session's detections |
| F3 | Filter by detection type | e.g. only "phone" rows |
| F4 | Severity badge correct | ≥0.85 = HIGH, ≥0.65 = MODERATE |
| F5 | Export CSV | File downloads with correct columns |

### G. Signal History

| # | Test | Expected |
|---|------|---------|
| G1 | New signals show session name | After `signals_v5.js` applied |
| G2 | Legacy signals show "legacy" | Signals sent before fix, amber label |
| G3 | Session filter works | Only selected session's signals |
| G4 | Date narrows session dropdown | Sessions active on that date only |
| G5 | Hide Shown | Signals disappear from view, count updates |
| G6 | Restore All | Hidden signals return |
| G7 | Refresh — hidden stays hidden | localStorage persists across reload |
| G8 | Export CSV — hidden excluded | Only visible entries in CSV |

### H. ESP32 / Serial

| # | Test | Expected |
|---|------|---------|
| H1 | Startup log | `[Signal] Route loaded — getActiveSession import: OK` |
| H2 | Command sent | `[Signal] Serial port COM3 opened` + `[Signal] Serial port flushed` |
| H3 | No replay on restart | Restart Node, no commands sent to ESP32 |
| H4 | ESP32 Serial Monitor | Shows `[Serial] Received: {"cmd":"start"}` |
| H5 | ESP32 unreachable | 202 response, "command logged but not delivered" |

### I. YOLO Integration

| # | Test | Expected |
|---|------|---------|
| I1 | Health check | `curl localhost:9999/` → `{"status":"ok","classes":{...}}` |
| I2 | Blank frame | `detection_count: 0` |
| I3 | Phone in frame | detection after ~3s threshold |
| I4 | Annotated frame on dashboard | Bounding boxes visible |
| I5 | Alert clip saved | `recordings/<session>/<seat>/alert_*.mp4` exists |
| I6 | YOLO down | System continues without crashing, null detections |

---

## 11. Known Issues & QoL Tasks

### Bugs (should fix before demo)

| # | Severity | Description | Fix |
|---|----------|-------------|-----|
| B1 | HIGH | Signals sent before `signals_v5.js` applied have null session_id → shown as "legacy" permanently | No fix for old data — inform users, new signals will be correct |
| B2 | MEDIUM | `wsHandler` broadcasts raw frame then annotated frame in same cycle — duplicate send to dashboard | Remove raw `broadcastBinary` call when annotated is available |
| B3 | LOW | Multiple rapid detections can queue several concurrent `flushAlertClip` ffmpeg processes | Add `flushInProgress` boolean guard per feed session |
| B4 | LOW | JWT expiry while pen page is open causes silent penlog failures — real BLE command still works | Acceptable for demo; fix post-demo with token refresh |
| B5 | LOW | No auth on WebSocket handshake — anyone with URL can inject a feed | Fix post-demo: verify JWT cookie in WS upgrade handler |

### QoL Optimizations

| # | Task | Impact |
|---|------|--------|
| Q1 | Add `INFERENCE_FPS` env var → hard limit per feed (currently relies on `isProcessing`) | Cleaner CPU throttle on slow hardware |
| Q2 | Batch detection inserts — current code does one `INSERT` per class per frame | Reduces DB write pressure with multiple classes |
| Q3 | Dashboard WS reconnect with exponential backoff instead of hard 3s reload | Prevents thundering herd on server restart |
| Q4 | Add `session_name` to alert clip filename | Easier manual file organization |
| Q5 | Use `pg.Pool` connection limit config in `db.js` | Prevents connection exhaustion under load |
| Q6 | Move `getActiveSession()` result to a 1s cache | Reduces DB queries on busy inference frames |
| Q7 | Replace `setTimeout(connect, 3000)` in camera.html with exponential backoff | Better reconnect on flaky networks |
| Q8 | Add `Content-Security-Policy` header | Basic XSS hardening |

---

## 12. Feature Roadmap

### Short-term (demo-ready extensions)

| Feature | Affected files |
|---------|---------------|
| Attendance CSV export (with candidate names) | `session.html`, `sessions_route.js` |
| Print attendance register | `session.html` (add `window.print()` button) |
| Candidate name shown in candidate summary table | `stats_v6.js` byFeed query — join `session_feeds` |
| Manual LED/buzzer trigger from dashboard (Bug 3 from earlier) | `dashboard.html` — send WS `{type:'signal',feedId,signal:'led_red'}` |
| Alert clip viewer in candidate page | `candidate.html` — list `detections WHERE alert_clip_path IS NOT NULL` |

### Medium-term

| Feature | Notes |
|---------|-------|
| Multi-admin support | Add `users` table, replace hardcoded `ADMIN_USERNAME` |
| Proctor notes on detections | Add `notes TEXT` column to detections, editable in candidate page |
| Session comparison view | Two sessions side by side in stats |
| Real-time detection count badge on dashboard cards | WS `detection` message already broadcasts to dashboard |
| Camera snapshot on detection (still image) | Write current frame to disk on alert trigger |

### Long-term

| Feature | Notes |
|---------|-------|
| HTTPS / ngrok for remote proctoring | Set `USE_HTTPS=true`, generate self-signed cert |
| Per-seat YOLO confidence threshold config | Add `detection_threshold` column to feeds |
| Seat-to-pen unit mapping | Add `wemos_unit_id` column to session_feeds |
| Historical video playback | Serve MP4 files via `/recordings` static route with auth |
| Report generation (PDF) | Use Puppeteer or WeasyPrint from session data |
| WebRTC instead of JPEG streaming | Lower latency, better quality, more bandwidth-efficient |

---

## 13. Instructor Notes & Decisions

### Architecture decisions log

**Why serial not WiFi for ESP32 commands?**  
ESP32 runs its own AP (`Proctopen 192.168.4.x`) for pens. If commands went over WiFi, Node.js would need to be on BOTH networks simultaneously (exam LAN and Proctopen AP) — impossible with one WiFi card. USB serial bypasses this entirely. Reliable, zero IP configuration.

**Why soft-delete on feeds instead of hard DELETE?**  
Hard DELETE with `ON DELETE CASCADE` would wipe all detections for a seat when it's removed from the dashboard between sessions. `ON DELETE SET NULL` preserves detection records with `feed_id=NULL`. The instructor can still see "Seat 01 — 3 alerts" in historical sessions even after that feed no longer exists.

**Why session_feeds for attendance?**  
The `feeds` table is soft-deleted at the start of each session. For historical sessions, all those feeds have `deleted_at` set. If we derive seat lists from `feeds WHERE deleted_at IS NULL`, we get the *current* session's seats with the historical session's detection counts — which is wrong. `session_feeds` is a denormalized snapshot of which seats were present during a specific session.

**Why base64 annotated image in single /infer response?**  
Original design had two round trips: `/infer` for detections, `/infer-annotated` for the image. AI friend simplified to one call returning both. At 4s timeout this saves 4s worst-case latency per frame. The base64 overhead is acceptable (~30% size increase) vs the latency saving.

**Why 3s cheating threshold?**  
A single frame detection can be a false positive (hand movement, glare, background). The 3s state machine in wsHandler requires sustained detection before firing an alert. Matches `why.py` `CHEAT_THRESHOLD_SECONDS = 3.0` from the original local test script.

**Why client-side "Hide Shown" instead of DB delete for signal history?**  
Signals are an audit trail. Deleting them defeats the purpose of having them. "Hide Shown" archives them from the proctor's view while preserving them in the DB. The IDs are stored in `localStorage` so they persist across page reloads without any server state.

**Why `startsWith` vs exact match in nav active highlight?**  
`current.startsWith('/session')` matched both `/session` and `/allsessions`, causing both to light up. Fixed in `nav_v3.js` with an exact match check for `/session` specifically. This is a CSS `active` class issue, not a routing issue.

### YOLO model notes

- Model: `best.pt` — custom YOLOv8 trained by AI friend
- Classes: `cheating`, `phone`, `cheatsheet`, `looking_away`
- Confidence threshold: `0.3` (matches `why.py`)
- Run on CPU: ~400-800ms/frame on i3-7020U at 12GB RAM
- Safe inference rate: 1fps (`YOLO_SAMPLE_MS=1000`) on that hardware
- `threaded=True` in Flask allows concurrent requests for multiple feeds

### Contribution breakdown

| Person | % | Role |
|--------|---|------|
| MARS | 42% | Full backend, all routes, DB schema, WebSocket pipeline, session system, signal history, sidebar, all page logic |
| Shams (pen friend) | 31% | ESP32 central firmware (BLE+AP+STA+TCP+OLED), Wemos firmware, Proctopen web app |
| AI friend | 17% | YOLO model training, `why.py`, inference pipeline refactor (FeedSession state machine) |
| Frontend friend | 5% | Frontend integration (pending) |
| Claude | ~5% | Architecture guidance, code review, integration decisions |

---

*Document generated: April 2026*  
*Backend version: v4 (session system, attendance, serial flush)*
