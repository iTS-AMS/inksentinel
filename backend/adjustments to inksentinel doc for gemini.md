# InkSentinel —  Project Documentation

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

## the db has now been expanded and the the sql code for it is in the schema_create.sql file. read that to be upto date on the db.

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
## 2.7 file hierarchy and structure

````
folder/
├── database/             ← Database configuration or migration files
├── node_modules/         ← Project dependencies
├── public/               ← Static assets and frontend views
│   ├── css/   
│   │    └── style.css              
│   ├── js/            
│   │    └── nav.js     
│   ├── penapp/  
│   │   ├── app.js
│   │   ├── penapp-ext.js
│   │   ├── stmng.js
│   │   ├── index.html 
│   │   ├── esp32_central_v4.ino 
│   │   ├── wemos_examinee_v5.ino
│   │   └── style.css       
│   ├── allsessions.html  
│   ├── camera.html       
│   ├── candidate.html    
│   ├── dashboard.html    
│   ├── history.html      
│   ├── incidents.html    
│   ├── login.html        
│   ├── session.html  
│   └── students-list.html      
├── recordings/           ← Storage for recorded media/streams
├── src/                  ← Application source code
│   ├── middleware/       ← Express middleware (e.g., auth, logging)
│   │   └── auth.js 
│   ├── pages/
│   │   └── router.js     ← Routes serving the HTML files from /public
│   ├── routes/
│   │   ├── auth.js       ← Authentication logic
│   │   ├── feeds.js      ← Video feed/stream management
│   │   ├── history.js    
│   │   ├── incidents.js  
│   │   ├── penlog.js     
│   │   ├── sessions.js   
│   │   ├── signals.js    
│   │   ├── stats.js     
│   │   └── students.js       
│   ├── db.js             ← Database connection/pool setup
│   ├── index.js          ← Main entry point for the server
│   ├── inferenceClient.js ← Client for AI/Inference processing
│   ├── recorder.js       ← Logic for handling media recording
│   └── wsHandler.js      ← WebSocket connection handling
├── .env                  ← Environment variables
├── .gitignore            ← Git exclusion rules
├──  package.json
└── .gitkeep              ← Ensures empty directories are tracked


````

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

# postgresql creds
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=surveillance
PG_USER=postgres
PG_PASSWORD=your_pass

JWT_SECRET=proctor_secret_key_change_this_later

ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$10$Dn6N9vVxLkE.QQyGxw5XjudamUxMu2KkBeCdxRa1VKxTcpTAbm44C
# proctor123 
# What IP address does the ESP32 have on the WiFi network? lets keep it as x for now and then ask shams about it later

# ESP32 via USB serial — check Device Manager > Ports on Windows
# common values: COM3, COM4, COM5
# on Linux: /dev/ttyUSB0 or /dev/ttyACM0
ESP32_SERIAL_PORT=COM3

VIDEO_DIR=./recordings

# INFERENCE_FPS=1 → one call per second — safe for i3-7020U CPU inference
# raise to 2 only if inference stays under 500ms consistently
INFERENCE_FPS=1

# YOLO runs on same machine as Node.js — always localhost
YOLO_URL=http://localhost:9999/infer
YOLO_ANNOTATED_URL=http://localhost:9999/infer-annotated

USE_HTTPS=false

```

---




## 5.2 current objective:
right now we are working proctopenapp's grid cards. this will be used instead of the dashboard moving forward but hasnt been fully fixed so we will do that last. we are trying to make the grid cards modal window work by adjusting some things in there.


## 5.3 current issues:

if you must modify code in the app.js file in order to fix the issues im listing (as in not even adding features in the penapp-ext.js isnt going to fix it), let me know where and why and the code in a different js file (patch-app.js or something like that) and where those changes should be done (like for adding a function, let me know of which line it should be pasted in and what code or function should be above and below the function you need implemented).

## 5.4 frontend issues

remove the edit and fluff you made for recommending the usb serial option. we will highlight it ourselves during demo so that it doesnt appear special.  i said it was most reliable for testing as letting you know, not to implement it. 

make the modal window design a bit landscape shaped and maybe a bit bigger. meaning longer on the sides. keep the top to bottom height tho. and we will need to move some of the divs around. 

leave the top part about unit number and address of the modal unchanged.


regarding the live feed. what you need to do is move the live feed to the top left and takes up around 60 percent of the sides and just below it should be the camera link field and alert confidence percentage or guage based on ai inference detections. 

from the top right should be the search drop down box for selecting students and right below that should be the field boxes that shows the results of the selection (student name and id for now and we can add other things later). would it be possible to search for students by writing parts of their name and id together  (currently i can only search up name or id as trying to do both partially leads no values being loaded)? and the buttons my friend made in the bottom.

basically kind of what was done for the candidate page but without logs or buttons (im saying no buttons as in you do not need to fiddle with the buttons by editing their functions. just have to move the buttons the pen friend already made)

regarding alerts, could you check if what i coded for notifying the admin about alert levels from inference going to work? i cant test it on my machine so im reliant on you for this. 




## 5.5 backend issues:

theres an issue of the remove student button not working properly after clicking save button for student details . the assign button doesnt work either as the fields for saving student details doesnt get auto filled after clicking assign.

camera link disappears in the modal window after we close the modal window and check back.

student details should be auto loaded into the student name and student id fields. maybe make these two divs into one and removing the selected student panel that appears after selecting from the search student drop down.

theres also another issue which is data persistence. previous data saved for the unit by using the current student name and id still staying after ending a session and refreshing the page. 


the biggest issue right now is when the proctopen page gets refreshed, everything gets erased but still some data persists like student data that got entered and saved by using the current text fields in the top.




## 6. Source Code — Backend

### 6.1 src/db.js

```javascript
// src/db.js 
// Adds camera_id generation to getOrCreateFeed.
// A short CAM-XXXX id is assigned once and never changes.
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

pool.on('error', err => console.error('DB pool error:', err.message));

export async function testConnection() {
  const r = await pool.query('SELECT NOW() AS time');
  console.log('DB connected at:', r.rows[0].time);
}

export async function query(sql, params = []) {
  return pool.query(sql, params);
}

export default pool;

// ── Camera ID generator (same charset as feeds_v2.js) ────────
function genCamId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CAM-';
  for (let i = 0; i < 4; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── getOrCreateFeed ──────────────────────────────────────────
// Upserts feed by client_id, assigning a camera_id if none exists.
export async function getOrCreateFeed(clientId, label) {
  // First try to get existing feed
  const existing = await query(
    `SELECT * FROM feeds WHERE client_id = $1`, [clientId]
  );

  if (existing.rows.length > 0) {
    const feed = existing.rows[0];
    // Assign camera_id if it was never set
    if (!feed.camera_id) {
      let camId;
      // Retry until we get a unique one (collision is astronomically rare)
      for (let attempts = 0; attempts < 5; attempts++) {
        camId = genCamId();
        const conflict = await query(
          `SELECT id FROM feeds WHERE camera_id = $1`, [camId]);
        if (!conflict.rows.length) break;
      }
      await query(
        `UPDATE feeds SET camera_id=$1, label=$2, connected=true, deleted_at=NULL
         WHERE client_id=$3`,
        [camId, label, clientId]
      );
      return (await query(`SELECT * FROM feeds WHERE client_id=$1`, [clientId])).rows[0];
    }
    // Already has camera_id — just mark connected
    await query(
      `UPDATE feeds SET label=$1, connected=true, deleted_at=NULL WHERE client_id=$2`,
      [label, clientId]
    );
    return (await query(`SELECT * FROM feeds WHERE client_id=$1`, [clientId])).rows[0];
  }

  // New feed — generate camera_id
  let camId;
  for (let attempts = 0; attempts < 5; attempts++) {
    camId = genCamId();
    const conflict = await query(`SELECT id FROM feeds WHERE camera_id=$1`, [camId]);
    if (!conflict.rows.length) break;
  }

  const result = await query(
    `INSERT INTO feeds (label, client_id, connected, camera_id)
     VALUES ($1, $2, true, $3) RETURNING *`,
    [label, clientId, camId]
  );
  console.log(`[DB] New feed "${label}" assigned camera_id: ${camId}`);
  return result.rows[0];
}

export async function getActiveSession() {
  const r = await query(
    `SELECT * FROM exam_sessions
     WHERE ended_at IS NULL ORDER BY created_at DESC LIMIT 1`
  );
  return r.rows[0] || null;
}

export async function resetAllConnected() {
  await query('UPDATE feeds SET connected = false');
  console.log('[DB] Reset all feeds to connected=false');
}
```

### 6.2 src/index.js

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
import studentRoutes  from './routes/students.js';   // ← new
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
app.use('/api/students',   studentRoutes);            // ← new

 
// app.get('/', (req, res) => {
//   res.send('Server is running');
// });

// create server
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

// attach WebSocket to server
setupWebSocket(server);
const HOST ='0.0.0.0';
server.listen(PORT, HOST ,() => {
  const proto = process.env.USE_HTTPS === 'true' ? 'https' : 'http';
  console.log(`Server running at ${proto}://localhost:${PORT}`);
  // Use your Hotspot IP here for the log
  // Example: http://192.168.137.1:3000
  console.log(`[Server] Accessible locally: ${proto}://localhost:${PORT}`);
  console.log(`[Server] Accessible on network: ${proto}://192.168.137.1:${PORT}`); 
});

testConnection();
resetAllConnected();
```

### 6.3 src/wsHandler.js  

> Key responsibilities:
> - Manages feed connections and dashboard client connections
> - Routes binary JPEG frames from cameras to dashboards
> - Runs YOLO inference pipeline with state machine (3s threshold)
> - Writes attendance to session_feeds on camera connect
> - Writes detections with session_id
> - Saves alert clips via ffmpeg
````js
// wsHandler.js 
import 'dotenv/config';
import { WebSocketServer }                       from 'ws';
import path                                      from 'path';
import { mkdirSync }                             from 'fs';
import { spawn }                                 from 'child_process';
import { FeedRecorder }                          from './recorder.js';
import { getOrCreateFeed, query, getActiveSession } from './db.js';
import { runInference, checkYoloHealth }         from './inferenceClient.js';

const SAMPLE_INTERVAL_MS  = Number(process.env.YOLO_SAMPLE_MS)    || 300;
const CHEAT_THRESHOLD_MS  = Number(process.env.CHEAT_THRESHOLD_MS) || 3000;
const RING_BUFFER_SECONDS = Number(process.env.RING_BUFFER_SEC)    || 30;
const RING_FPS            = 10;
const RING_MAX_FRAMES     = RING_BUFFER_SECONDS * RING_FPS;
const FORCE_RAW_STREAM    = process.env.FORCE_RAW_STREAM === 'true';
const CHEATING_CLASSES    = new Set(['phone', 'cheatsheet', 'looking_away', 'cheating']);

const connectedFeeds   = new Map();
const dashboardClients = new Set();
const feedSessions     = new Map();

class FeedSession {
  constructor(feedId, label, recorder) {
    this.feedId            = feedId;
    this.label             = label;
    this.recorder          = recorder;
    this.sessionId         = null;
    this.isProcessing      = false;
    this.lastProcessedTime = 0;
    this.ringBuffer        = [];
    this.cheatStartTime    = null;
    this.alertFired        = false;
    this.currentDetections = [];
    this.detectionCount    = 0;
    this.showAnnotated     = false;
    this.annotatedFrame    = null;
    this.cheatingActive    = false;
  }

  pushFrame(jpegBuffer, annotated = false) {
    this.ringBuffer.push({ jpegBuffer, annotated, ts: new Date() });
    if (this.ringBuffer.length > RING_MAX_FRAMES) this.ringBuffer.shift();
  }

  updateDetectionState(detections, detectionCount, annotatedFrame) {
    const now          = Date.now();
    const isSuspicious = this._isSuspicious(detections, detectionCount);
    this.currentDetections = detections;
    this.detectionCount    = detectionCount;
    this.annotatedFrame    = annotatedFrame || null;

    if (isSuspicious) {
      if (this.cheatStartTime === null) {
        this.cheatStartTime = now;
        this.alertFired     = false;
        console.log(`[State] Feed ${this.feedId}: suspicious activity started`);
      }
      const elapsed       = now - this.cheatStartTime;
      this.showAnnotated  = true;
      this.cheatingActive = elapsed >= CHEAT_THRESHOLD_MS;
      if (this.cheatingActive && !this.alertFired) {
        this.alertFired = true;
        return { alertTriggered: true };
      }
    } else {
      if (this.cheatStartTime !== null)
        console.log(`[State] Feed ${this.feedId}: suspicious activity ended`);
      this.cheatStartTime = null;
      this.alertFired     = false;
      this.cheatingActive = false;
      this.showAnnotated  = false;
    }
    return { alertTriggered: false };
  }

  _isSuspicious(detections, detectionCount) {
    if (detectionCount === 0) return false;
    if (detections.filter(d => d.class === 'person').length > 1) return true;
    return detections.some(d => CHEATING_CLASSES.has(d.class));
  }
}

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  checkYoloHealth();
  wss.on('connection', (ws, req) => {
    const url   = new URL(req.url, 'http://localhost');
    const role  = url.searchParams.get('role');
    const label = url.searchParams.get('label') || 'Camera';
    if (role === 'feed')      { handleFeedConnection(ws, req, label); return; }
    if (role === 'dashboard') { handleDashboardConnection(ws); return; }
    ws.close(4000, 'Unknown role');
  });
  console.log('[WS] WebSocket server ready on /ws');
  return wss;
}

async function handleFeedConnection(ws, req, label) {
  const clientId = `${req.socket.remoteAddress}_${label}`;
  console.log(`[WS] Feed connecting: "${label}"`);

  let feed;
  try {
    feed = await getOrCreateFeed(clientId, label);
  } catch (err) {
    console.error('[WS] Failed to get/create feed:', err.message);
    ws.close(); return;
  }

  await query('UPDATE feeds SET connected = true WHERE id = $1', [feed.id]);

  // ── Active session + attendance ───────────────────────────
  const activeSession = await getActiveSession();
  const sessionName   = activeSession?.name || null;
  const sessionId     = activeSession?.id   || null;

  if (sessionId) {
    // UPSERT attendance — reconnects don't duplicate
    await query(
      `INSERT INTO session_feeds (session_id, feed_id, feed_label, connected_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (session_id, feed_id) DO NOTHING`,
      [sessionId, feed.id, feed.label]
    ).catch(err => console.error('[WS] Attendance insert error:', err.message));
    console.log(`[WS] Attendance: feed "${label}" in session "${sessionName}"`);
  } else {
    console.warn(`[WS] Feed "${label}" — no active session, attendance not recorded`);
  }

  const recorder    = new FeedRecorder(feed.id, feed.label, sessionName, sessionId);
  recorder.start();

  const session     = new FeedSession(feed.id, feed.label, recorder);
  session.sessionId = sessionId;
  feedSessions.set(ws, session);
  connectedFeeds.set(feed.id, ws);

  broadcastJSON({ type: 'feed_connected', feed_id: feed.id, label: feed.label });
  console.log(`[WS] Feed "${label}" ready (id=${feed.id})`);

  ws.on('message', (data, isBinary) => {
    if (!isBinary) return;
    const session = feedSessions.get(ws);
    if (!session) return;
    const jpegBuffer = Buffer.from(data);

    session.recorder.writeFrame(jpegBuffer);
    session.pushFrame(jpegBuffer, false);

    const frameToSend = (!FORCE_RAW_STREAM && session.showAnnotated && session.annotatedFrame)
      ? session.annotatedFrame : jpegBuffer;
    const feedIdBuf = Buffer.alloc(4);
    feedIdBuf.writeUInt32BE(session.feedId, 0);
    broadcastBinary(Buffer.concat([feedIdBuf, frameToSend]));

    broadcastJSON({
      type: 'detection', feed_id: session.feedId,
      detections: session.currentDetections,
      detection_count: session.detectionCount,
      annotated: session.showAnnotated,
      cheating_active: session.cheatingActive,
    });

    if (ws.readyState === 1) {
      try {
        ws.send(JSON.stringify({
          type: 'detection', feed_id: session.feedId,
          detections: session.currentDetections,
          detection_count: session.detectionCount,
        }));
      } catch (_) {}
    }

    _maybeRunInference(session, jpegBuffer);
  });

  ws.on('close', () => {
    const session = feedSessions.get(ws);
    if (session) {
      session.recorder.stop();
      connectedFeeds.delete(session.feedId);
      feedSessions.delete(ws);
      query('UPDATE feeds SET connected = false WHERE id = $1', [session.feedId])
        .catch(err => console.error('[WS] DB disconnect error:', err.message));
      broadcastJSON({ type: 'feed_disconnected', feed_id: session.feedId });
    }
    console.log(`[WS] Feed "${label}" disconnected`);
  });

  ws.on('error', err => console.error(`[WS] Feed "${label}" error:`, err.message));
}

function _maybeRunInference(session, jpegBuffer) {
  const now = Date.now();
  if (now - session.lastProcessedTime < SAMPLE_INTERVAL_MS) return;
  if (session.isProcessing) return;
  session.isProcessing      = true;
  session.lastProcessedTime = now;

  runInference(jpegBuffer).then(async result => {
    if (!result.ok) return;
    const { detections, detection_count, annotatedFrame } = result;
    const { alertTriggered } = session.updateDetectionState(detections, detection_count, annotatedFrame);
    if (annotatedFrame) session.pushFrame(annotatedFrame, true);

    if (detection_count > 0)
      _saveDetections(session.sessionId, session.feedId, detections)
        .catch(err => console.error('[Inference] DB save error:', err.message));

    if (alertTriggered) {
      console.log(`[Alert] Feed ${session.feedId}: confirmed — saving clip`);
      _saveAlertClip(session).catch(err => console.error('[Alert] Clip error:', err.message));
    }

    broadcastJSON({
      type: 'detection', feed_id: session.feedId,
      detections, detection_count,
      annotated: session.showAnnotated,
      cheating_active: session.cheatingActive,
    });
  }).finally(() => { session.isProcessing = false; });
}

async function _saveDetections(sessionId, feedId, detections) {
  for (const det of detections) {
    await query(
      `INSERT INTO detections (session_id, feed_id, detected_at, class_label, confidence)
       VALUES ($1, $2, NOW(), $3, $4)`,
      [sessionId, feedId, det.class, det.confidence]
    );
  }
}

async function _saveAlertClip(session) {
  const frames = [...session.ringBuffer];
  if (!frames.length) return;
  const clipPath = path.join(
    session.recorder.dir,
    `alert_${new Date().toISOString().replace(/[:.]/g,'-')}.mp4`
  );
  await new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-f','mjpeg','-framerate',String(RING_FPS),'-i','pipe:0',
      '-c:v','libx264','-preset','fast','-crf','26','-pix_fmt','yuv420p','-y', clipPath
    ], { stdio: ['pipe','ignore','pipe'] });
    ff.stderr.on('data', c => { if (/error/i.test(c.toString())) console.error(`[Alert] ffmpeg: ${c.toString().trim()}`); });
    ff.on('error', reject);
    ff.on('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg code ${code}`)));
    for (const { jpegBuffer } of frames) ff.stdin.write(jpegBuffer);
    ff.stdin.end();
  });
  console.log(`[Alert] Clip saved: ${clipPath} (${frames.length} frames)`);
  await query(
    `UPDATE detections SET alert_clip_path = $1
     WHERE id = (SELECT id FROM detections WHERE feed_id = $2 ORDER BY detected_at DESC LIMIT 1)`,
    [clipPath, session.feedId]
  ).catch(err => console.error('[Alert] alert_clip_path update:', err.message));
}

function handleDashboardConnection(ws) {
  dashboardClients.add(ws);
  for (const [feedId] of connectedFeeds) {
    const s = [...feedSessions.values()].find(s => s.feedId === feedId);
    if (s) {
      try { ws.send(JSON.stringify({ type: 'feed_connected', feed_id: feedId, label: s.label })); }
      catch (_) {}
    }
  }
  ws.on('message', data => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'signal') {
        const feedWs = connectedFeeds.get(Number(msg.feedId));
        if (feedWs?.readyState === 1)
          feedWs.send(JSON.stringify({ type: 'signal', signal: msg.signal }));
      }
    } catch (_) {}
  });
  ws.on('close', () => dashboardClients.delete(ws));
  ws.on('error', () => dashboardClients.delete(ws));
}

// Exported so signals.js can push signal_ack messages to all dashboard
// clients (including the candidate page open in the proctor's browser)
// without needing a separate event bus or circular imports.
export function broadcastJSON(data) {
  const msg = JSON.stringify(data);
  for (const client of [...dashboardClients]) {
    if (client.readyState === 1) {
      try { client.send(msg); } catch (_) { dashboardClients.delete(client); }
    }
  }
}

function broadcastBinary(buffer) {
  for (const client of [...dashboardClients]) {
    if (client.readyState === 1) {
      try { client.send(buffer); } catch (_) { dashboardClients.delete(client); }
    }
  }
}

export function getConnectedFeeds() { return connectedFeeds; }
````
### 6.4 src/recorder.js 


> Key responsibilities:
> - Opens ffmpeg process per feed for continuous MP4 segmentation (10 min each)
> - Uses session name as top-level folder: `recordings/<session>/<seat>/`
> - `flushAlertClip()` writes ring buffer frames to 30s alert clip

````js
// recorder.js
// Handles continuous MP4 segment recording per feed and alert clip flushing.
//
// Directory structure:
//   recordings/
//     <session_name>/          ← set when FeedRecorder is created
//       Seat_01/
//         Seat_01_seg_0000_2026-04-12_09-30-00.mp4
//         Seat_01_alert_2026-04-12_09-35-22.mp4
//
// session_name comes from the active exam_sessions row passed in from wsHandler.
// If no session is active, falls back to a timestamp folder (safe default).

import 'dotenv/config';
import { spawn }               from 'child_process';
import { mkdirSync, statSync } from 'fs';
import path                    from 'path';
import { query }               from './db.js';

const VIDEO_DIR        = process.env.VIDEO_DIR || './recordings';
const SEGMENT_DURATION = 10 * 60 * 1000; // 10 minutes
const FFMPEG_FPS       = 10;

// ── Helpers ───────────────────────────────────────────────────

function formatTs(d) {
  const pad = n => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  );
}

function sanitise(label) {
  return label.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
}

function writeFramesToMp4(frames, outPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-f',         'mjpeg',
      '-framerate', String(FFMPEG_FPS),
      '-i',         'pipe:0',
      '-c:v',       'libx264',
      '-preset',    'fast',
      '-crf',       '26',
      '-pix_fmt',   'yuv420p',
      '-y',
      outPath
    ], { stdio: ['pipe', 'ignore', 'pipe'] });

    ff.stderr.on('data', chunk => {
      const line = chunk.toString();
      if (/error|invalid/i.test(line))
        console.error('[Recorder] ffmpeg (one-shot):', line.trim());
    });

    ff.on('error', reject);
    ff.on('exit', code => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });

    for (const buf of frames) {
      try { ff.stdin.write(buf); } catch (_) {}
    }
    try { ff.stdin.end(); } catch (_) {}
  });
}

// ── FeedRecorder ──────────────────────────────────────────────

export class FeedRecorder {
  /**
   * @param {number} feedId
   * @param {string} label        - human label e.g. "Seat 01"
   * @param {string} sessionName  - active session name (filesystem-safe)
   *                                pass '' or null to fallback to timestamp
   * @param {number|null} sessionId - DB session id for video_segments insert
   */
  constructor(feedId, label, sessionName = null, sessionId = null) {
    this.feedId    = feedId;
    this.label     = label;
    this.labelSafe = sanitise(label);
    this.sessionId = sessionId;

    // Use session name as folder, fallback to timestamp if none active
    const folder   = sessionName ? sanitise(sessionName) : formatTs(new Date());
    this.dir       = path.join(VIDEO_DIR, folder, this.labelSafe);
    mkdirSync(this.dir, { recursive: true });

    this.ffmpeg      = null;
    this.segmentId   = null;
    this.segmentPath = null;
    this.segmentIdx  = 0;
    this.timer       = null;
    this.running     = false;

    console.log(`[Recorder] Feed ${feedId} ("${label}") → ${this.dir}`);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._openSegment();
  }

  stop() {
    this.running = false;
    clearTimeout(this.timer);
    this._closeSegment();
  }

  writeFrame(jpegBuffer) {
    if (!this.ffmpeg?.stdin?.writable) return;
    try { this.ffmpeg.stdin.write(jpegBuffer); }
    catch (err) { console.error(`[Recorder] Write error (feed ${this.feedId}):`, err.message); }
  }

  getCurrentSegmentId() { return this.segmentId; }

  async flushAlertClip(frames, detectionId) {
    if (!frames || frames.length === 0) return null;

    const ts        = formatTs(new Date());
    const alertPath = path.join(this.dir, `${this.labelSafe}_alert_${ts}.mp4`);

    console.log(`[Recorder] Flushing ${frames.length} frames → ${alertPath}`);

    try {
      await writeFramesToMp4(frames, alertPath);

      await query(
        'UPDATE detections SET alert_clip_path = $1 WHERE id = $2',
        [alertPath, detectionId]
      );

      return alertPath;
    } catch (err) {
      console.error(`[Recorder] flushAlertClip error (feed ${this.feedId}):`, err.message);
      return null;
    }
  }

  _openSegment() {
    const ts = formatTs(new Date());
    this.segmentPath = path.join(
      this.dir,
      `${this.labelSafe}_seg_${String(this.segmentIdx).padStart(4,'0')}_${ts}.mp4`
    );

    this.ffmpeg = spawn('ffmpeg', [
      '-f',         'mjpeg',
      '-framerate', String(FFMPEG_FPS),
      '-i',         'pipe:0',
      '-c:v',       'libx264',
      '-preset',    'fast',
      '-crf',       '26',
      '-pix_fmt',   'yuv420p',
      '-y',
      this.segmentPath
    ], { stdio: ['pipe', 'ignore', 'pipe'] });

    this.ffmpeg.stderr.on('data', chunk => {
      const line = chunk.toString();
      if (/error|invalid/i.test(line))
        console.error(`[Recorder] ffmpeg (feed ${this.feedId}):`, line.trim());
    });

    this.ffmpeg.on('error', err => {
      console.error(`[Recorder] Spawn error (feed ${this.feedId}):`, err.message);
    });

    this.ffmpeg.on('exit', code => {
      if (code !== 0 && code !== null)
        console.error(`[Recorder] ffmpeg exit code ${code} (feed ${this.feedId})`);
    });

    // Insert video_segments DB row — include session_id if available
    query(
      `INSERT INTO video_segments (session_id, feed_id, file_path, started_at)
       VALUES ($1, $2, $3, NOW()) RETURNING id`,
      [this.sessionId, this.feedId, this.segmentPath]
    ).then(result => {
      this.segmentId = result.rows[0].id;
      console.log(`[Recorder] Segment ${this.segmentIdx} opened (feed ${this.feedId})`);
      this.segmentIdx++;
    }).catch(err => {
      console.error('[Recorder] DB segment insert error:', err.message);
    });

    this.timer = setTimeout(() => {
      if (this.running) this._rotateSegment();
    }, SEGMENT_DURATION);
  }

  _rotateSegment() {
    this._closeSegment();
    this._openSegment();
  }

  _closeSegment() {
    if (this.ffmpeg) {
      try { this.ffmpeg.stdin.end(); } catch (_) {}
      this.ffmpeg = null;
    }

    if (this.segmentId !== null) {
      let size = 0;
      try { size = statSync(this.segmentPath).size; } catch (_) {}

      query(
        `UPDATE video_segments SET ended_at = NOW(), size_bytes = $1 WHERE id = $2`,
        [size, this.segmentId]
      ).catch(err => {
        console.error('[Recorder] DB close segment error:', err.message);
      });

      this.segmentId   = null;
      this.segmentPath = null;
    }
  }
}
````

### 6.5 src/inferenceClient.js  

```javascript
// inferenceClient.js
// Sends JPEG frames to the Python YOLO server and returns detections + annotated image.
//
// Contract (matches server_v2.py):
//   POST /infer
//     Body:    raw JPEG bytes (Content-Type: image/jpeg)
//     Returns: JSON {
//       "detection_count": int,
//       "detections": [{"class": str, "confidence": float}],
//       "annotated_image": "<base64 JPEG or null>"
//     }
//
//   GET /health → {"status": "ok", "classes": {...}}
//
// Design:
//   - Single endpoint — no separate /infer-annotated round trip
//   - 4s timeout — tight enough to drop stale frames on slow CPU
//   - Returns typed InferenceResult so wsHandler can pattern-match cleanly
//   - Throttle is handled in wsHandler via isProcessing + SAMPLE_INTERVAL_MS

import 'dotenv/config';

// YOLO_API_URL in .env — points to localhost:9999 or ngrok tunnel
// Note: port 9999 (matches server_v2.py), NOT 8000 from AI friend's env
const YOLO_BASE  = process.env.YOLO_API_URL || 'http://localhost:9999';
const INFER_URL  = `${YOLO_BASE}/infer`;
const TIMEOUT_MS = process.env.YOLO_TIMEOUT_MS
  ? Number(process.env.YOLO_TIMEOUT_MS)
  : 4000;

/**
 * @typedef {Object} Detection
 * @property {string} class
 * @property {number} confidence
 */

/**
 * @typedef {Object} InferenceResult
 * @property {boolean}     ok
 * @property {Detection[]} detections
 * @property {number}      detection_count
 * @property {Buffer|null} annotatedFrame  - decoded JPEG, null if no detections
 * @property {string|null} error
 */

/**
 * Send one JPEG frame to the YOLO API.
 * @param  {Buffer} jpegBuffer
 * @returns {Promise<InferenceResult>}
 */
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

    // Decode base64 annotated image — null when no detections
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

    return {
      ok:              false,
      detections:      [],
      detection_count: 0,
      annotatedFrame:  null,
      error:           msg,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Health-check the YOLO API on startup.
 * @returns {Promise<boolean>}
 */
export async function checkYoloHealth() {
  try {
    const res = await fetch(`${YOLO_BASE}/health`, {
      signal: AbortSignal.timeout(3000)
    });
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
import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import jwt from 'jsonwebtoken';
// this file is for JWT cookie checking 
// for page routes — redirects to /login if not authenticated
export function requireAuth(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.redirect('/login');
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.clearCookie('token');
    res.redirect('/login');
  }
}

// for API routes — returns JSON instead of redirecting
export function requireAuthApi(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

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
import dotenv from 'dotenv';
dotenv.config({quiet: true});

import { Router } from 'express';
import jwt        from 'jsonwebtoken';
import bcrypt     from 'bcryptjs';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // check username
  if (!username || username !== process.env.ADMIN_USERNAME) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // check password against stored hash
  const valid = bcrypt.compareSync(password, process.env.ADMIN_PASSWORD_HASH);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // sign a JWT token
  const token = jwt.sign(
    { username, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  // store token in HTTP-only cookie
  res.cookie('token', token, {
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000
  });

  res.json({ success: true, redirect: '/dashboard' });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, redirect: '/login' });
});

export default router;
```

### 6.8 src/routes/feeds.js 

> Key: DELETE uses `UPDATE feeds SET deleted_at = NOW()` not hard DELETE.
> GET only returns feeds WHERE `deleted_at IS NULL`.

````js
// src/routes/feeds.js  (v2)
// Adds camera_id generation on upsert.
// camera_id is a short 8-char code shown on the camera page.
// Format: CAM-XXXX where XXXX is uppercase alphanumeric.
import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

// ── Generate a short unique camera ID ────────────────────────
function genCamId() {
  const chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code     = 'CAM-';
  for (let i = 0; i < 4; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── GET /api/feeds ────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        f.id,
        f.label,
        f.client_id,
        f.connected,
        f.camera_id,
        f.created_at,
        f.deleted_at,
        COUNT(d.id)  AS alert_count
      FROM   feeds f
      LEFT   JOIN detections d ON d.feed_id = f.id
      WHERE  f.deleted_at IS NULL
      GROUP  BY f.id
      ORDER  BY f.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[Feeds] List error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── GET /api/feeds/:id ────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid feed ID' });

  try {
    const feedResult = await query(`
      SELECT f.*, COUNT(d.id) AS alert_count
      FROM   feeds f
      LEFT   JOIN detections d ON d.feed_id = f.id
      WHERE  f.id = $1
      GROUP  BY f.id
    `, [id]);

    if (!feedResult.rows.length)
      return res.status(404).json({ error: 'Feed not found' });

    const detResult = await query(`
      SELECT id, class_label, confidence, detected_at, alert_clip_path
      FROM   detections
      WHERE  feed_id = $1
      ORDER  BY detected_at DESC
      LIMIT  20
    `, [id]);

    res.json({ ...feedResult.rows[0], detections: detResult.rows });
  } catch (err) {
    console.error('[Feeds] Get error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── DELETE /api/feeds/:id  (soft delete) ─────────────────────
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid feed ID' });

  try {
    const check = await query(
      'SELECT connected FROM feeds WHERE id = $1 AND deleted_at IS NULL', [id]);

    if (!check.rows.length)
      return res.status(404).json({ error: 'Feed not found' });

    if (check.rows[0].connected)
      return res.status(400).json({
        error: 'Cannot remove a connected feed — disconnect the camera first'
      });

    await query(
      'UPDATE feeds SET deleted_at = NOW() WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (err) {
    console.error('[Feeds] Delete error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
export { genCamId };
````

### 6.9 src/routes/history.js 
````js
// ============================================================
//  src/routes/history.js
//
//  GET    /api/history  — signal rows joined to exam_sessions
//                         so session_name is returned
//  DELETE /api/history  — clear signals by source or all
//
//  Supported query params:
//    ?sessionId=N      — filter by session
//    ?source=admin|pen_app
//    ?cmd=start|pause|...
//    ?date=YYYY-MM-DD
//
//  WHY session_name was null:
//    The original history route selected only from signals sg
//    with no JOIN to exam_sessions. Even though session_id was
//    correctly written by signals_v5.js, the route never fetched
//    the name. Adding LEFT JOIN exam_sessions s ON s.id = sg.session_id
//    and selecting s.name AS session_name fixes it.
// ============================================================

import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

// ── GET /api/history ─────────────────────────────────────────
router.get('/', async (req, res) => {
  const { source, cmd, date, sessionId } = req.query;

  // ── Base query — JOIN to exam_sessions for session name ───
  // The LEFT JOIN ensures signals with session_id=NULL (legacy)
  // still appear — s.name will be null for those rows, which
  // the frontend renders as "legacy" in amber.
  let sql = `
    SELECT
      sg.id,
      sg.signal          AS cmd,
      sg.params,
      sg.sent_at         AS ts,
      sg.sent_by,
      s.name             AS session_name
    FROM   signals sg
    LEFT   JOIN exam_sessions s
           ON  s.id = sg.session_id
    WHERE  1=1
  `;
  const vals = [];

  // ── Build WHERE clauses from query params ─────────────────
  // All params use $N placeholders — never string-interpolated

  if (sessionId) {
    vals.push(parseInt(sessionId));
    sql += ` AND sg.session_id = $${vals.length}`;
  }

  if (source && source !== 'all') {
    vals.push(source);
    sql += ` AND sg.sent_by = $${vals.length}`;
  }

  if (cmd && cmd !== 'all') {
    vals.push(cmd);
    sql += ` AND sg.signal = $${vals.length}`;
  }

  if (date) {
    // Cast timestamptz to date for calendar-day comparison
    vals.push(date);
    sql += ` AND sg.sent_at::date = $${vals.length}`;
  }

  sql += ' ORDER BY sg.sent_at DESC';

  try {
    const result = await query(sql, vals);

    // Parse params JSONB — pg driver returns it as object if column
    // type is jsonb, as string if text. Handle both.
    const entries = result.rows.map(r => ({
      id:           r.id,
      cmd:          r.cmd,
      ts:           r.ts,
      sent_by:      r.sent_by,
      session_name: r.session_name,   // null for legacy signals
      params: typeof r.params === 'string'
        ? JSON.parse(r.params || '{}')
        : (r.params || {}),
    }));

    res.json({ entries });

  } catch (err) {
    console.error('[History] Query error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── DELETE /api/history ───────────────────────────────────────
// ?source=pen_app  → delete only pen app signals
// no param         → delete all signals
// Note: "Clear All" in the UI uses client-side hide (localStorage),
// not this endpoint. This endpoint is only for actual DB deletion.
router.delete('/', async (req, res) => {
  const { source } = req.query;
  try {
    if (source && source !== 'all') {
      await query('DELETE FROM signals WHERE sent_by = $1', [source]);
    } else {
      await query('DELETE FROM signals');
    }
    console.log('[History] Signals cleared', source ? `(source: ${source})` : '(all)');
    res.json({ cleared: true });
  } catch (err) {
    console.error('[History] Clear error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
````

### 6.10 src/routes/incidents.js 
````js
// src/routes/incidents.js
import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

router.get('/', async (req, res) => {
  const { feedId, classLabel, sessionId } = req.query;

  // Build parameterized query — no string interpolation
  let sql    = `
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
````

### 6.11 src/routes/penlog.js 

> Key: writes session_id so pen app signals appear in signal history with session name.

````js
// src/routes/penlog.js
import 'dotenv/config';
import { Router }                   from 'express';
import { requireAuthApi }           from '../middleware/auth.js';
import { query, getActiveSession }  from '../db.js';

const router = Router();
router.use(requireAuthApi);

router.post('/', async (req, res) => {
  const { cmd, device_id, duration_ms, punish_ms, time_ms, transport } = req.body;
  if (!cmd) return res.status(400).json({ error: 'cmd is required' });

  const params = {};
  if (device_id)   params.device_id   = device_id;
  if (duration_ms) params.duration_ms = duration_ms;
  if (punish_ms)   params.punish_ms   = punish_ms;
  if (time_ms)     params.time_ms     = time_ms;
  if (transport)   params.transport   = transport;

  const session   = await getActiveSession();
  const sessionId = session?.id || null;

  try {
    await query(
      `INSERT INTO signals (session_id, signal, params, sent_by)
       VALUES ($1, $2, $3, 'pen_app')`,
      [sessionId, cmd, JSON.stringify(params)]
    );
    res.json({ logged: true });
  } catch (err) {
    console.error('[PenLog] DB error:', err.message);
    res.status(500).json({ error: 'Log failed' });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT sg.signal AS cmd, sg.params, sg.sent_at AS ts, s.name AS session_name
      FROM   signals sg
      LEFT   JOIN exam_sessions s ON s.id = sg.session_id
      WHERE  sg.sent_by = 'pen_app'
      ORDER  BY sg.sent_at DESC
      LIMIT  100
    `);
    const entries = result.rows.map(r => ({
      ts:           r.ts,
      cmd:          r.cmd,
      session_name: r.session_name,
      ...(typeof r.params === 'string' ? JSON.parse(r.params || '{}') : (r.params || {}))
    }));
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: 'Read failed' });
  }
});

router.delete('/', async (req, res) => {
  try {
    await query("DELETE FROM signals WHERE sent_by = 'pen_app'");
    res.json({ cleared: true });
  } catch (err) {
    res.status(500).json({ error: 'Clear failed' });
  }
});

export default router;
````

### 6.12 src/routes/sessions.js  

> Endpoints: GET /, GET /active, GET /:id/attendance, PATCH /:id/attendance/:sfId, POST /, PUT /:id/end  
> Key fixes: writes session_id, serial port flush() on open prevents replay.


```javascript
// src/routes/sessions.js v4
// GET /api/sessions/:id/attendance — returns session_feeds rows
// Added: candidate_name PATCH endpoint for updating names

import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

// GET /api/sessions
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        s.id, s.name, s.course_name, s.instructor_name,
        s.time_block, s.created_at, s.ended_at,
        COUNT(DISTINCT d.id)       AS detection_count,
        COUNT(DISTINCT sf.feed_id) AS seat_count
      FROM exam_sessions s
      LEFT JOIN detections   d  ON d.session_id  = s.id
      LEFT JOIN session_feeds sf ON sf.session_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);
    res.json({ sessions: result.rows });
  } catch (err) {
    console.error('[Sessions] List error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/sessions/active
router.get('/active', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM exam_sessions WHERE ended_at IS NULL ORDER BY created_at DESC LIMIT 1`
    );
    res.json({ session: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/sessions/:id/attendance
// Returns all seats that connected during this session
router.get('/:id/attendance', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid session ID' });

  try {
    const result = await query(`
      SELECT
        sf.id,
        sf.feed_id,
        sf.feed_label,
        sf.candidate_name,
        sf.connected_at,
        COUNT(d.id) AS alert_count
      FROM   session_feeds sf
      LEFT   JOIN detections d
             ON  d.feed_id    = sf.feed_id
             AND d.session_id = sf.session_id
      WHERE  sf.session_id = $1
      GROUP  BY sf.id, sf.feed_id, sf.feed_label, sf.candidate_name, sf.connected_at
      ORDER  BY sf.feed_label
    `, [id]);

    res.json({ attendance: result.rows });
  } catch (err) {
    console.error('[Sessions] Attendance error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// PATCH /api/sessions/:id/attendance/:sfId
// Update candidate_name and/or student_id for an attendance row
router.patch('/:id/attendance/:sfId', async (req, res) => {
  const sfId  = parseInt(req.params.sfId);
  const { candidate_name, student_id } = req.body;
  if (isNaN(sfId)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const updates = [];
    const params  = [];
    if (candidate_name !== undefined) {
      params.push(candidate_name || null);
      updates.push('candidate_name = $' + params.length);
    }
    if (student_id !== undefined) {
      params.push(student_id || null);
      updates.push('student_id = $' + params.length);
    }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(sfId);
    await query(
      'UPDATE session_feeds SET ' + updates.join(', ') + ' WHERE id = $' + params.length,
      params
    );
    res.json({ updated: true });
  } catch (err) {
    console.error('[Sessions] Attendance update error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/sessions
router.post('/', async (req, res) => {
  const { name, course_name, instructor_name, time_block } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Session name is required' });

  const safeName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '_');

  try {
    await query(`UPDATE exam_sessions SET ended_at = NOW() WHERE ended_at IS NULL`);
    await query(`UPDATE feeds SET deleted_at = NOW(), connected = false WHERE deleted_at IS NULL`);

    const result = await query(
      `INSERT INTO exam_sessions (name, course_name, instructor_name, time_block)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [safeName, course_name || null, instructor_name || null, time_block || null]
    );

    console.log(`[Sessions] New session: "${result.rows[0].name}" (id=${result.rows[0].id})`);
    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    console.error('[Sessions] Create error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/sessions/:id/end
router.put('/:id/end', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid session ID' });

  try {
    const result = await query(
      `UPDATE exam_sessions SET ended_at = NOW()
       WHERE id = $1 AND ended_at IS NULL RETURNING *`,
      [id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Session not found or already ended' });
    res.json({ session: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
```

### 6.13 src/routes/signals.js 

> Key: three-tier byFeed source: session_feeds → detections → current feeds.
> Prevents historical session showing wrong seat data.

```javascript
// ============================================================
//  src/routes/signals.js  (v7)
//
//  Changes from v6:
//  - Imports broadcastJSON from wsHandler.js so it can push
//    real-time ack messages to all dashboard clients (including
//    the candidate page) after a confirmed serial write.
//
//  - After HTTP 200 path (serial write succeeded): broadcasts
//    { type: 'signal_ack', cmd, device_id, status: 'delivered' }
//    This lets candidate.html show a per-unit "Delivered ✓"
//    confirmation without polling.
//
//  - After HTTP 202 path (ESP32 unreachable): broadcasts
//    { type: 'signal_ack', cmd, device_id, status: 'undelivered' }
//    So the candidate page still gets a real-time update (amber).
//
//  - Serial port 'data' event listener parses JSON echo lines
//    from ESP32 firmware. When firmware is updated to send acks
//    (e.g. {"ack":"ok","cmd":"start","unit":1}), this handler
//    will forward them as { type: 'serial_ack' } WS messages.
//    Currently a no-op until firmware supports it.
//
//  - portOpening flag and async getPort() from v6 unchanged.
// ============================================================

import 'dotenv/config';
import { Router }                   from 'express';
import { query, getActiveSession }  from '../db.js';
import { requireAuthApi }           from '../middleware/auth.js';
import { SerialPort }               from 'serialport';
import { broadcastJSON }            from '../wsHandler.js';

const router = Router();
router.use(requireAuthApi);

console.log('[Signal] Route loaded — getActiveSession import:',
  typeof getActiveSession === 'function' ? 'OK' : 'MISSING ⚠');
console.log('[Signal] Route loaded — broadcastJSON import:',
  typeof broadcastJSON === 'function' ? 'OK' : 'MISSING ⚠');

const VALID_COMMANDS = ['timer','start','pause','end','reset','warn','disable','enable','deduct'];
const UNIT_COMMANDS  = ['warn','disable','enable','deduct'];
const NEEDS_DURATION = ['timer'];
const NEEDS_TIME_MS  = ['deduct'];

// ── Serial port state ────────────────────────────────────────
let port         = null;
let portOpening  = false;
let lastOpenAttempt = 0;
const REOPEN_COOLDOWN_MS = 5000;

// Buffer for partial lines coming in from serial
let serialLineBuf = '';

// ── Serial data handler ───────────────────────────────────────
// Parses newline-delimited JSON from ESP32.
// Currently logs all incoming lines for debugging.
// When ESP32 firmware is updated to send ack JSON like:
//   {"ack":"ok","cmd":"start","unit":1}
//   {"ack":"ok","cmd":"start","unit":"all"}
// this function will forward them as WS messages to dashboard
// clients so candidate.html can show per-unit confirmation.
function handleSerialData(chunk) {
  serialLineBuf += chunk.toString();
  const lines = serialLineBuf.split('\n');

  // Keep the last partial line in the buffer
  serialLineBuf = lines.pop();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    console.log(`[Signal] Serial RX: ${trimmed}`);

    // Try to parse as JSON ack from ESP32 firmware
    try {
      const msg = JSON.parse(trimmed);

      if (msg.ack) {
        // Forward to all dashboard clients (including candidate page)
        // candidate.html listens for type:'serial_ack' to show
        // per-unit hardware confirmation (future feature once firmware updated)
        broadcastJSON({
          type:      'serial_ack',
          ack:       msg.ack,         // 'ok' | 'err'
          cmd:       msg.cmd,
          unit:      msg.unit,        // unit id or 'all'
          raw:       trimmed,
        });
        console.log(`[Signal] Serial ack forwarded: cmd=${msg.cmd} unit=${msg.unit}`);
      }
    } catch (_) {
      // Not JSON — plain ESP32 debug output, already logged above
    }
  }
}

// ── Serial port open — async, waits for 'open' event ─────────
// Returns a ready port or null. portOpening flag prevents stacking
// concurrent open attempts (the v5 fix for the freeze bug).
async function getPort() {
  if (port?.isOpen) return port;
  if (portOpening) return null;

  const now = Date.now();
  if (now - lastOpenAttempt < REOPEN_COOLDOWN_MS) return null;

  const portPath = process.env.ESP32_SERIAL_PORT;
  if (!portPath) {
    console.warn('[Signal] ESP32_SERIAL_PORT not set — serial disabled');
    return null;
  }

  portOpening     = true;
  lastOpenAttempt = now;

  return new Promise(resolve => {
    let p;
    try {
      p = new SerialPort({ path: portPath, baudRate: 115200, autoOpen: true });
    } catch (err) {
      console.error('[Signal] Failed to create SerialPort:', err.message);
      portOpening = false;
      resolve(null);
      return;
    }

    p.once('open', () => {
      console.log(`[Signal] Serial port ${portPath} opened`);
      port = p;

      // Flush OS buffer — prevents replay of pre-restart commands
      p.flush(err => {
        if (err) console.error('[Signal] Flush error:', err.message);
        else     console.log('[Signal] Serial port flushed — buffer cleared');
      });

      // ── Listen for incoming data from ESP32 ───────────────
      // Handles both debug prints and future ack JSON from firmware
      p.on('data', handleSerialData);

      p.on('error', err => {
        console.error('[Signal] Serial error (post-open):', err.message);
        port = null;
      });
      p.on('close', () => {
        console.log('[Signal] Serial port closed');
        port          = null;
        serialLineBuf = ''; // clear partial buffer on disconnect
      });

      portOpening = false;
      resolve(p);
    });

    p.once('error', err => {
      console.error('[Signal] Serial open error:', err.message);
      portOpening = false;
      port        = null;
      resolve(null);
    });
  });
}

// Write one newline-terminated JSON command to the ESP32.
async function sendToESP32(payload) {
  const p = await getPort();
  if (!p) throw new Error('ESP32_UNREACHABLE');

  return new Promise((resolve, reject) => {
    p.write(JSON.stringify(payload) + '\n', err => {
      if (err) {
        console.error('[Signal] Write error:', err.message);
        port = null;
        return reject(new Error('ESP32_UNREACHABLE'));
      }
      resolve();
    });
  });
}

// ── POST /api/signal ─────────────────────────────────────────
router.post('/', async (req, res) => {
  const { cmd, device_id, duration_ms, punish_ms, time_ms } = req.body;

  if (!cmd || !VALID_COMMANDS.includes(cmd))
    return res.status(400).json({
      error: `Invalid command. Must be one of: ${VALID_COMMANDS.join(', ')}`
    });

  if (UNIT_COMMANDS.includes(cmd) && !device_id)
    return res.status(400).json({ error: `${cmd} requires device_id` });
  if (NEEDS_DURATION.includes(cmd) && !duration_ms)
    return res.status(400).json({ error: 'timer requires duration_ms' });
  if (NEEDS_TIME_MS.includes(cmd) && !time_ms)
    return res.status(400).json({ error: 'deduct requires time_ms' });

  const esp32Payload = { cmd };
  if (device_id)   esp32Payload.device_id   = device_id;
  if (duration_ms) esp32Payload.duration_ms = duration_ms;
  if (punish_ms)   esp32Payload.punish_ms   = punish_ms;
  if (time_ms)     esp32Payload.time_ms     = time_ms;

  const session   = await getActiveSession();
  const sessionId = session?.id || null;
  if (!sessionId)
    console.warn('[Signal] No active session — signal stored as legacy');

  try {
    // Always log to DB first, regardless of ESP32 state
    await query(
      `INSERT INTO signals (session_id, signal, params, sent_by)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, cmd, JSON.stringify(esp32Payload), req.user.username]
    );
    console.log(`[Signal] ${req.user.username} sent (session=${sessionId}):`, esp32Payload);

    // ── Try to deliver to ESP32 ───────────────────────────
    await sendToESP32(esp32Payload);

    // ── HTTP 200: serial write confirmed ──────────────────
    // Broadcast signal_ack so candidate.html can show
    // "Delivered ✓" in real-time without a page refresh.
    // unit: device_id for unit commands, 'all' for global ones.
    broadcastJSON({
      type:      'signal_ack',
      status:    'delivered',
      cmd,
      unit:      device_id || 'all',
      duration_ms: duration_ms || null,
      time_ms:     time_ms     || null,
    });

    res.json({ success: true, sent: esp32Payload });

  } catch (err) {
    if (err.message === 'ESP32_UNREACHABLE') {
      // ── HTTP 202: logged but not delivered ───────────────
      // Still broadcast so candidate page updates immediately
      broadcastJSON({
        type:   'signal_ack',
        status: 'undelivered',
        cmd,
        unit:   device_id || 'all',
      });

      return res.status(202).json({
        warning: 'ESP32 not connected — command logged but not delivered',
        sent:    esp32Payload,
        logged:  true,
      });
    }
    console.error('[Signal] Unexpected error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
```

### 6.14 src/routes/stats.js 

````js
// ============================================================
//  src/routes/stats.js  (v6)
//
//  Changes from v5:
//  - byFeed fallback overhauled. Previous fallback used
//    `feeds WHERE deleted_at IS NULL` (current active feeds).
//    This was wrong for historical sessions: the feeds that had
//    detections in session 1 may now be soft-deleted (when
//    session 2 started), so they don't appear in the current
//    feeds table. Result was 0 alerts shown for all seats.
//
//    New fallback derives seats from the detections table itself:
//    SELECT DISTINCT feed_id FROM detections WHERE session_id=$1
//    This always gives the correct seat list for any session,
//    regardless of whether session_feeds was populated or the
//    feed is now soft-deleted.
//
//  - Added comment explaining why two fallback paths exist.
// ============================================================

import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

router.get('/', async (req, res) => {
  try {
    // ── Resolve session ───────────────────────────────────────
    // ?session_id=N → specific historical session
    // no param      → currently active session
    // no active     → return zeros (fresh install / all ended)
    let sessionId   = req.query.session_id ? parseInt(req.query.session_id) : null;
    let sessionInfo = null;

    if (!sessionId) {
      const active = await query(
        `SELECT * FROM exam_sessions
         WHERE  ended_at IS NULL
         ORDER  BY created_at DESC
         LIMIT  1`
      );
      if (active.rows.length > 0) {
        sessionId   = active.rows[0].id;
        sessionInfo = active.rows[0];
      }
    } else {
      const si = await query('SELECT * FROM exam_sessions WHERE id = $1', [sessionId]);
      sessionInfo = si.rows[0] || null;
    }

    // ── No session — return zeros ─────────────────────────────
    // Avoids leaking global counts onto a blank dashboard
    if (!sessionId) {
      const liveResult = await query(
        `SELECT COUNT(*) AS cnt
         FROM feeds WHERE connected = true AND deleted_at IS NULL`
      );
      return res.json({
        sessionId:    null,
        sessionInfo:  null,
        totalAlerts:  0,
        flaggedFeeds: 0,
        liveFeeds:    Number(liveResult.rows[0].cnt),
        clearFeeds:   0,
        byClass:      {},
        byFeed:       [],
      });
    }

    // ── Summary counts ────────────────────────────────────────
    const summary = await query(`
      SELECT
        (SELECT COUNT(*)
         FROM   detections
         WHERE  session_id = $1)                              AS total_alerts,

        (SELECT COUNT(DISTINCT feed_id)
         FROM   detections
         WHERE  session_id = $1
         AND    feed_id IS NOT NULL)                          AS flagged_feeds,

        (SELECT COUNT(*)
         FROM   feeds
         WHERE  connected = true AND deleted_at IS NULL)      AS live_feeds
    `, [sessionId]);

    // ── Detection class breakdown ─────────────────────────────
    const byClass = await query(`
      SELECT class_label, COUNT(*) AS count
      FROM   detections
      WHERE  session_id = $1
      GROUP  BY class_label
      ORDER  BY count DESC
    `, [sessionId]);

    // ── Per-seat breakdown — three-tier source priority ───────
    //
    // Tier 1: session_feeds (attendance table)
    //   Best source — populated in real-time as cameras connect.
    //   Available for sessions that ran with wsHandler_v4+.
    //   Gives correct seat labels even for soft-deleted feeds.
    //
    // Tier 2: detections table (derive seats from who was caught)
    //   Fallback when session_feeds has no rows (historical sessions
    //   before attendance tracking was added, or Demo_Session seed).
    //   This is the KEY FIX: detections always have feed_id from when
    //   the detection was recorded, so even if the feed is now
    //   soft-deleted we get the right label via the feed JOIN.
    //
    // Tier 3: current active feeds (last resort)
    //   Used only when the session has NO detections yet AND no
    //   attendance records — e.g. session just started, no cameras
    //   connected yet. Shows the available seats as a preview.

    // Check session_feeds first
    const sfCheck = await query(
      `SELECT COUNT(*) AS cnt FROM session_feeds WHERE session_id = $1`,
      [sessionId]
    );
    const hasAttendance = Number(sfCheck.rows[0].cnt) > 0;

    // Check detections for this session
    const detCheck = await query(
      `SELECT COUNT(DISTINCT feed_id) AS cnt
       FROM detections WHERE session_id = $1 AND feed_id IS NOT NULL`,
      [sessionId]
    );
    const hasDetections = Number(detCheck.rows[0].cnt) > 0;

    let byFeed;

    if (hasAttendance) {
      // ── Tier 1: session_feeds ─────────────────────────────
      byFeed = await query(`
        SELECT
          sf.feed_id                       AS id,
          sf.feed_label                    AS label,
          COALESCE(f.connected, false)     AS connected,
          COUNT(d.id)                      AS alerts
        FROM   session_feeds sf
        LEFT   JOIN feeds f
               ON  f.id = sf.feed_id
        LEFT   JOIN detections d
               ON  d.feed_id    = sf.feed_id
               AND d.session_id = $1
        WHERE  sf.session_id = $1
        GROUP  BY sf.feed_id, sf.feed_label, f.connected
        ORDER  BY sf.feed_label
      `, [sessionId]);

    } else if (hasDetections) {
      // ── Tier 2: derive seats from detections ──────────────
      // Correct for historical sessions without session_feeds rows.
      // JOIN to feeds for the label — the feed row still exists
      // even after soft-delete (deleted_at just hides it from
      // the dashboard, the row is not removed).
      byFeed = await query(`
        SELECT
          d.feed_id                        AS id,
          COALESCE(f.label, 'Seat (removed)') AS label,
          COALESCE(f.connected, false)     AS connected,
          COUNT(d.id)                      AS alerts
        FROM   detections d
        LEFT   JOIN feeds f ON f.id = d.feed_id
        WHERE  d.session_id = $1
        AND    d.feed_id IS NOT NULL
        GROUP  BY d.feed_id, f.label, f.connected
        ORDER  BY label
      `, [sessionId]);

    } else {
      // ── Tier 3: current active feeds (preview only) ───────
      byFeed = await query(`
        SELECT
          f.id,
          f.label,
          f.connected,
          0 AS alerts
        FROM   feeds f
        WHERE  f.deleted_at IS NULL
        ORDER  BY f.id
      `);
    }

    const s         = summary.rows[0];
    const liveFeeds = Number(s.live_feeds);
    const flagged   = Number(s.flagged_feeds);

    res.json({
      sessionId,
      sessionInfo,
      totalAlerts:  Number(s.total_alerts),
      flaggedFeeds: flagged,
      liveFeeds,
      clearFeeds:   Math.max(0, liveFeeds - flagged),
      byClass: Object.fromEntries(
        byClass.rows.map(r => [r.class_label, Number(r.count)])
      ),
      byFeed: byFeed.rows.map(r => ({
        id:        r.id,
        label:     r.label,
        connected: r.connected,
        alerts:    Number(r.alerts),
      })),
    });

  } catch (err) {
    console.error('[Stats]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
````

### 6.15 src/routes/students.js 

````js
// ============================================================
//  src/routes/students.js  (v2)
//
//  Fix from v1: removed s.camera_id from SELECT.
//  camera_id lives on the feeds table, not students.
//  All other logic unchanged.
//
//  GET /api/students        — paginated + searchable roster
//  GET /api/students/:id    — single student + enrollments
//  GET /api/students/by-section/:section_id
// ============================================================

import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

// ── GET /api/students ─────────────────────────────────────────
router.get('/', async (req, res) => {
  const q         = req.query.q          || '';
  const sectionId = req.query.section_id ? parseInt(req.query.section_id) : null;
  const page      = Math.max(1, parseInt(req.query.page)  || 1);
  const limit     = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset    = (page - 1) * limit;

  const params = [];
  let sql = `
    SELECT
      s.id,
      s.name,
      s.student_id,
      s.email,
      s.seat_number,
      s.pen_unit_id,
      s.client_id,
      sec.section_name,
      sec.course_code,
      sec.initials     AS instructor_initials,
      c.course_name
    FROM   students s
    LEFT   JOIN sections sec ON sec.section_id = s.section_id
    LEFT   JOIN courses  c   ON c.course_code  = sec.course_code
    WHERE  1=1
  `;

  if (q.trim()) {
    params.push(`%${q.trim()}%`);
    sql += ` AND (s.name ILIKE $${params.length}
                  OR s.student_id ILIKE $${params.length})`;
  }

  if (sectionId) {
    params.push(sectionId);
    sql += ` AND s.section_id = $${params.length}`;
  }

  // Get total count for pagination
  const countSql = `SELECT COUNT(*) AS total FROM (${sql}) sub`;
  const countRes = await query(countSql, params).catch(() => null);
  const total    = countRes ? Number(countRes.rows[0].total) : 0;

  // Add pagination
  sql    += ' ORDER BY s.name ASC';
  params.push(limit);  sql += ` LIMIT  $${params.length}`;
  params.push(offset); sql += ` OFFSET $${params.length}`;

  try {
    const result = await query(sql, params);
    res.json({
      students: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[Students] List error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── GET /api/students/by-section/:section_id ─────────────────
// Must come BEFORE /:student_id to avoid route collision
router.get('/by-section/:section_id', async (req, res) => {
  const sectionId = parseInt(req.params.section_id);
  if (isNaN(sectionId)) return res.status(400).json({ error: 'Invalid section ID' });

  try {
    const result = await query(`
      SELECT
        s.id, s.name, s.student_id, s.email,
        s.seat_number, s.pen_unit_id
      FROM   students s
      WHERE  s.section_id = $1
      ORDER  BY s.name
    `, [sectionId]);
    res.json({ students: result.rows });
  } catch (err) {
    console.error('[Students] By-section error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── GET /api/students/:student_id ────────────────────────────
router.get('/:student_id', async (req, res) => {
  const studentId = req.params.student_id;

  try {
    const studentRes = await query(`
      SELECT
        s.id, s.name, s.student_id, s.email,
        s.seat_number, s.pen_unit_id, s.client_id,
        sec.section_name,
        sec.course_code,
        sec.initials  AS instructor_initials,
        c.course_name
      FROM   students s
      LEFT   JOIN sections sec ON sec.section_id = s.section_id
      LEFT   JOIN courses  c   ON c.course_code  = sec.course_code
      WHERE  s.student_id = $1
    `, [studentId]);

    if (!studentRes.rows.length)
      return res.status(404).json({ error: 'Student not found' });

    const enrollRes = await query(`
      SELECT
        sec.section_id,
        sec.section_name,
        sec.course_code,
        sec.initials,
        sec.year,
        sec.year_session,
        c.course_name
      FROM   student_sections ss
      JOIN   sections sec ON sec.section_id = ss.section_id
      JOIN   courses  c   ON c.course_code  = sec.course_code
      WHERE  ss.std_id = $1
      ORDER  BY sec.course_code, sec.section_name
    `, [studentId]);

    res.json({
      student:     studentRes.rows[0],
      enrollments: enrollRes.rows,
    });
  } catch (err) {
    console.error('[Students] Detail error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
````
### 6.16 src/pages/router.js

```javascript
import 'dotenv/config';
import { Router } from 'express';
import path       from 'path';
import { fileURLToPath } from 'url';
import jwt        from 'jsonwebtoken';
import { requireAuth } from '../middleware/auth.js';

const router    = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC    = path.join(__dirname, '..', '..', 'public');

const page = (name) => path.join(PUBLIC, `${name}.html`);

router.get('/', requireAuth, (req, res) => res.redirect('/dashboard'));

router.get('/login', (req, res) => {
  try {
    jwt.verify(req.cookies?.token, process.env.JWT_SECRET);
    res.redirect('/dashboard');
  } catch {
    res.sendFile(page('login'));
  }
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
router.get('/students-list', requireAuth, (req, res) => res.sendFile(page('students-list')));

export default router;


```

---

## 7. Source Code — Frontend

### 7.1.1 public/css/style.css  
````css
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

/* ── Variables ───────────────────────────────────────────── */
:root {
  --bg:      #07080d;
  --surface: #0d1117;
  --raised:  #131920;
  --accent:  #00d4ff;
  --adim:    rgba(0, 212, 255, 0.12);
  --red:     #ff3b3b;
  --rdim:    rgba(255, 59, 59, 0.12);
  --amber:   #ffb020;
  --green:   #00c853;
  --t1:      #e2e8f0;
  --t2:      #8899aa;
  --t3:      #445566;
  --border:  rgba(0, 212, 255, 0.10);
  --fd:      'Barlow Condensed', sans-serif;
  --fm:      'JetBrains Mono', monospace;
}

/* ── Reset ───────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 14px; }
body {
  background: var(--bg);
  color: var(--t1);
  font-family: var(--fm);
  min-height: 100vh;
  background-image: repeating-linear-gradient(
    0deg, transparent, transparent 2px,
    rgba(0,212,255,0.012) 2px, rgba(0,212,255,0.012) 4px
  );
}

/* ── Layout ──────────────────────────────────────────────── */
.layout  { display: flex; min-height: 100vh; }
.sidebar {
  width: 200px; min-width: 200px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
}
.main { flex: 1; padding: 28px 30px; overflow: auto; }

/* ── Sidebar ─────────────────────────────────────────────── */
.logo {
  display: flex; align-items: center; gap: 10px;
  padding: 22px 20px;
  border-bottom: 1px solid var(--border);
}
.logo-icon { color: var(--accent); font-size: 20px; }
.logo-text {
  font-family: var(--fd); font-weight: 800;
  font-size: 18px; letter-spacing: 0.18em;
}
.nav { flex: 1; padding: 12px 10px; display: flex; flex-direction: column; gap: 2px; }
.nav a {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 12px; border-radius: 4px;
  color: var(--t2); font-size: 12px;
  letter-spacing: 0.05em; text-decoration: none;
  transition: all 0.12s;
}
.nav a:hover   { color: var(--t1); background: var(--adim); }
.nav a.active  {
  background: var(--adim); color: var(--accent);
  border-left: 2px solid var(--accent);
  padding-left: 10px;
}
.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
}
.logout-btn {
  width: 100%; display: flex; align-items: center; gap: 6px;
  padding: 7px 10px; background: transparent;
  border: 1px solid var(--border); border-radius: 4px;
  color: var(--t2); font-size: 11px; letter-spacing: 0.05em;
  cursor: pointer; font-family: var(--fm); transition: all 0.12s;
}
.logout-btn:hover { color: var(--t1); border-color: rgba(0,212,255,0.3); }

/* ── Page header ─────────────────────────────────────────── */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.page-title  { font-family: var(--fd); font-size: 26px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.page-sub    { font-size: 12px; color: var(--t2); margin-top: 3px; }

/* ── Card ────────────────────────────────────────────────── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px; padding: 20px;
}
.card-title {
  font-family: var(--fd); font-weight: 700;
  font-size: 13px; letter-spacing: 0.10em;
  color: var(--t2); margin-bottom: 14px; text-transform: uppercase;
}

/* ── Buttons ─────────────────────────────────────────────── */
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 16px; border-radius: 4px;
  border: 1px solid transparent;
  font-size: 12px; font-weight: 500;
  letter-spacing: 0.05em; font-family: var(--fm);
  cursor: pointer; transition: all 0.15s; text-decoration: none;
}
.btn-primary { background: var(--accent); color: var(--bg); border-color: var(--accent); }
.btn-primary:hover { background: #33ddff; }
.btn-ghost   { background: transparent; color: var(--t2); border-color: var(--border); }
.btn-ghost:hover { color: var(--t1); background: var(--adim); }
.btn-danger  { background: var(--rdim); color: var(--red); border-color: rgba(255,59,59,0.3); }
.btn-danger:hover { background: rgba(255,59,59,0.22); }
.btn-warn    { background: rgba(255,176,32,0.12); color: var(--amber); border-color: rgba(255,176,32,0.3); }
.btn-green   { background: rgba(0,200,83,0.12); color: var(--green); border-color: rgba(0,200,83,0.3); }

/* ── Inputs ──────────────────────────────────────────────── */
.input {
  width: 100%; background: var(--raised);
  border: 1px solid var(--border); border-radius: 4px;
  padding: 10px 14px; color: var(--t1);
  font-size: 13px; font-family: var(--fm); outline: none;
  transition: border-color 0.15s;
}
.input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--adim); }
.input::placeholder { color: var(--t3); }
label {
  display: block; font-size: 11px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--t2); margin-bottom: 6px;
}

/* ── Table ───────────────────────────────────────────────── */
.table { width: 100%; border-collapse: collapse; }
.table th {
  text-align: left; padding: 10px 14px; font-size: 10px;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--t3); border-bottom: 1px solid var(--border);
}
.table td {
  padding: 11px 14px; font-size: 12px; color: var(--t1);
  border-bottom: 1px solid rgba(0,212,255,0.04);
}
.table tr:hover td { background: var(--adim); }

/* ── Badge ───────────────────────────────────────────────── */
.badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 8px; border-radius: 3px; font-size: 10px;
  font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
}
.badge-live  { background: rgba(0,200,83,0.12);  color: var(--green); }
.badge-alert { background: var(--rdim);           color: var(--red); }
.badge-warn  { background: rgba(255,176,32,0.12); color: var(--amber); }
.badge-off   { background: rgba(68,85,102,0.3);   color: var(--t3); }

/* ── Feed grid ───────────────────────────────────────────── */
.feed-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.feed-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 14px; overflow: hidden;
  cursor: pointer; transition: all 0.2s;
  text-decoration: none; color: inherit; display: block;
}
.feed-card:hover   { border-color: rgba(0,212,255,0.3); box-shadow: 0 0 20px rgba(0,212,255,0.1); }
.feed-card.alert   { border-color: var(--red); box-shadow: 0 0 20px rgba(255,59,59,0.2); }
.feed-card.offline { opacity: 0.6; }
.feed-video {
  aspect-ratio: 16/9; background: var(--bg);
  display: flex; align-items: center; justify-content: center;
  position: relative;
}
.feed-placeholder { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.feed-icon        { font-size: 32px; color: var(--t3); }
.feed-status-text { font-size: 10px; letter-spacing: 0.12em; color: var(--t3); }
.feed-badge {
  position: absolute; top: 8px; left: 8px;
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 8px; border-radius: 3px;
  font-size: 9px; font-weight: 700; letter-spacing: 0.12em;
  backdrop-filter: blur(4px);
}
.feed-badge.live    { background: rgba(0,200,83,0.85);  color: #fff; }
.feed-badge.alert   { background: rgba(255,59,59,0.85); color: #fff; }
.feed-badge.offline { background: rgba(40,50,60,0.85);  color: var(--t3); }
.feed-dot { width: 5px; height: 5px; border-radius: 50%; background: #fff; animation: pulse 2s infinite; }
.feed-footer { padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; }
.feed-name  { font-family: var(--fd); font-weight: 700; font-size: 14px; letter-spacing: 0.04em; text-transform: uppercase; }
.feed-flags { font-size: 10px; color: var(--amber); }

/* ── KPI row ─────────────────────────────────────────────── */
.kpi-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 20px; }
.kpi-card { text-align: center; padding: 20px 16px; }
.kpi-val  { font-family: var(--fd); font-weight: 800; font-size: 52px; line-height: 1; margin-bottom: 6px; }
.kpi-lbl  { font-size: 10px; letter-spacing: 0.12em; color: var(--t3); text-transform: uppercase; }

/* ── Filter bar ──────────────────────────────────────────── */
.filter-bar {
  display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end;
  padding: 16px 20px; background: var(--surface);
  border: 1px solid var(--border); border-radius: 8px; margin-bottom: 16px;
}
.filter-group { display: flex; flex-direction: column; gap: 5px; min-width: 150px; }

/* ── Profile grid ────────────────────────────────────────── */
.profile-grid { display: grid; grid-template-columns: 1fr 300px; gap: 20px; align-items: start; }
.video-large {
  aspect-ratio: 16/9; background: var(--bg); border-radius: 14px;
  border: 1px solid var(--border); position: relative;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px; overflow: hidden;
}
.video-large.alert { border-color: var(--red); box-shadow: 0 0 30px rgba(255,59,59,0.2); }
.video-top-bar {
  position: absolute; top: 10px; left: 10px; right: 10px;
  display: flex; justify-content: space-between; align-items: center;
}
.alert-banner {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: rgba(255,59,59,0.9); padding: 8px 14px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
}
.info-row   { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid rgba(0,212,255,0.04); font-size: 12px; }
.info-label { color: var(--t3); }
.signal-group { margin-bottom: 16px; }
.signal-label { font-size: 10px; letter-spacing: 0.10em; color: var(--t3); margin-bottom: 8px; text-transform: uppercase; }
.led-row { display: flex; gap: 8px; margin-bottom: 6px; }
.led-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }

/* ── Login ───────────────────────────────────────────────── */
.login-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; position: relative; }
.login-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent);
}
.login-panel {
  position: relative; width: 380px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 14px; padding: 32px 36px;
  box-shadow: 0 0 60px rgba(0,212,255,0.06), 0 4px 24px rgba(0,0,0,0.5);
}
.login-logo    { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
.login-icon    { font-size: 36px; color: var(--accent); line-height: 1; }
.login-title   { font-family: var(--fd); font-weight: 800; font-size: 26px; letter-spacing: 0.18em; }
.login-sub     { font-size: 9px; letter-spacing: 0.14em; color: var(--t3); text-transform: uppercase; }
.login-heading { font-family: var(--fd); font-weight: 700; font-size: 20px; letter-spacing: 0.12em; margin-bottom: 4px; }
.login-desc    { font-size: 11px; color: var(--t3); letter-spacing: 0.06em; margin-bottom: 24px; }
.form-field    { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.error-box     {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; background: var(--rdim);
  border: 1px solid rgba(255,59,59,0.25); border-radius: 4px;
  font-size: 12px; color: var(--red); margin-bottom: 12px;
}
.login-footer  { margin-top: 24px; text-align: center; font-size: 9px; letter-spacing: 0.10em; color: var(--t3); }
.submit-btn    { width: 100%; justify-content: center; padding: 11px; font-size: 13px; letter-spacing: 0.12em; font-weight: 700; }

/* ── Misc ────────────────────────────────────────────────── */
.divider { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
.text-red   { color: var(--red); }
.text-amber { color: var(--amber); }
.text-green { color: var(--green); }
.text-dim   { color: var(--t3); }
.breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; font-size: 11px; letter-spacing: 0.08em; }
.breadcrumb a { color: var(--accent); text-decoration: none; }
.breadcrumb a:hover { text-decoration: underline; }
.breadcrumb span { color: var(--t3); }

/* ── Scrollbar ───────────────────────────────────────────── */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--t3); border-radius: 3px; }

/* ── Animations ──────────────────────────────────────────── */
@keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.3;} }




/* ════════════════════════════════════════════════════════════
   REPLACE the previous style additions block at the bottom
   of public/css/style.css with this entire block.
   ════════════════════════════════════════════════════════════

   STICKY SIDEBAR — why previous version didn't work:
   The original .layout had min-height:100vh but no explicit
   height, and .main had overflow:auto which creates a new
   scroll container. Sticky only works relative to the nearest
   scrolling ancestor. If that ancestor is <body> or <html>,
   we need the sidebar to scroll with the page, not the .main.

   Fix: make <body> / <html> the scroll container (default),
   remove overflow from .main, and use position:sticky on
   .sidebar with top:0 and height:100vh.
   ════════════════════════════════════════════════════════════ */

/* Ensure the page scrolls on the root, not inside .main */
html, body {
  height: 100%;
  overflow: auto; /* scroll happens here, not in .main */
}

.layout {
  display: flex;
  min-height: 100vh;
  align-items: flex-start; /* critical — stretch breaks sticky */
}

/* Remove any overflow:auto from .main that creates a sub-scroll container */
.main {
  flex: 1;
  padding: 28px 30px;
  /* NO overflow property here — page scroll must stay on body */
  min-width: 0; /* prevents flex overflow on narrow screens */
}

/* Sticky sidebar */
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;   /* allows sidebar nav to scroll if it overflows */
  flex-shrink: 0;
  transition: width 0.2s ease, min-width 0.2s ease;
}

/* ── Toggle button ─────────────────────────────────────────── */
.sidebar-toggle-btn {
  width: 100%;
  margin-top: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--t3);
  font-size: 10px;
  cursor: pointer;
  font-family: var(--fm);
  transition: all 0.12s;
}
.sidebar-toggle-btn:hover {
  color: var(--accent);
  border-color: rgba(0,212,255,0.3);
}

/* sidebar-footer: column so toggle sits below logout */
.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 0;
  /* stick to bottom of sidebar */
  margin-top: auto;
}

/* ── Collapsed state ───────────────────────────────────────── */
.sidebar.collapsed {
  width: 52px;
  min-width: 52px;
}

.sidebar.collapsed .logo-text,
.sidebar.collapsed .nav-label {
  display: none;
}

.sidebar.collapsed .logo {
  justify-content: center;
  padding: 22px 0;
}
.sidebar.collapsed .nav a {
  justify-content: center;
  padding: 10px 0;
}
.sidebar.collapsed .nav a.active {
  border-left: 2px solid var(--accent);
  padding-left: 0;
}
.sidebar.collapsed .sidebar-footer {
  padding: 12px 8px;
}
.sidebar.collapsed .logout-btn {
  justify-content: center;
  padding: 7px 0;
}

/* ── Nav icon/label helpers ─────────────────────────────────── */
.nav-icon  { flex-shrink: 0; }
.nav-label { white-space: nowrap; overflow: hidden; }

/* ── Session banner ──────────────────────────────────────────── */
.session-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--adim);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 12px;
}
.session-banner .session-name {
  font-family: var(--fd);
  font-weight: 700;
  font-size: 14px;
  color: var(--accent);
  letter-spacing: 0.06em;
}
.session-banner .session-meta { color: var(--t2); }
.session-banner .session-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 6px var(--green);
  flex-shrink: 0;
}


````


### 7.1.2 public/js/nav.js  

### 7.1.2 public/js/nav.js  
### 7.1.2 public/js/nav.js  
### 7.1.2 public/js/nav.js  
### 7.1.2 public/js/nav.js  
### 7.1.2 public/js/nav.js  
### 7.1.2 public/js/nav.js  
### 7.1.2 public/js/nav.js  
### 7.1.2 public/js/front.html  
### 7.1.2 public/js/front.html  
### 7.1.2 public/js/front.html  
### 7.1.2 public/js/front.html  
### 7.1.2 public/js/front.html  
### 7.1.2 public/js/front.html  
### 7.1.2 public/js/front.html  
### 7.1.2 public/js/front.html  
### 7.1.2 public/penapp/pen.html  
### 7.1.2 public/penapp/pen.js  
### 7.1.2 public/penapp/pen.css  
### 7.1.2 public/penapp/stmng.js  
### 7.1.2 public/penapp/e32.ino  
### 7.1.2 public/penapp/wmos.ino  


### 7.3 Sidebar usage pattern

Every page with a sidebar must call both lines:
```javascript
document.getElementById('sidebar').innerHTML = buildSidebar();
initSidebar(); // restores collapse state from localStorage
```

Every `<div id="sidebar">` must have inline style to prevent layout jump:
```html
<div id="sidebar" style="min-width:200px;width:200px;flex-shrink:0"></div>
```


