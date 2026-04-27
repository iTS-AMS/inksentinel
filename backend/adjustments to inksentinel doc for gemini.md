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
5. [Environment Variables and currennt objects and issues needing to be fixed](#5-environment-variables)
6. [Source Code — Backend](#6-source-code--backend)
7. [Source Code — Frontend](#7-source-code--frontend)

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
right now we are working proctopenapp's grid cards. this will be used instead of the dashboard moving forward but hasnt been fully fixed so we will do that last.for now, we are trying to make the grid cards modal window work by adjusting some things in there.
you are not allowed to make changes to app.js file. make necessary changes in penapp-ext.js if you need to.

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
````js
// public/js/nav.js
const PAGES = [
  { href: '/dashboard',     label: 'Dashboard',    icon: '⊞' },
  { href: '/session',       label: 'Session',      icon: '◎' },
  { href: '/allsessions',   label: 'All Sessions', icon: '☰' },
  { href: '/incidents',     label: 'Incidents',    icon: '△' },
  { href: '/history',       label: 'Sig. History', icon: '◷' },
  { href: '/pen',           label: 'Pen Control',  icon: '✒' },
  { href: '/students-list', label: 'Students',     icon: '◫' },
];

function buildSidebar() {
  const current = window.location.pathname;

  const nav = PAGES.map(p => {
    // /session must match exactly — otherwise /allsessions also highlights it
    const isActive = p.href === '/session'
      ? current === '/session'
      : current.startsWith(p.href);
    return `
    <a href="${p.href}" class="${isActive ? 'active' : ''}" title="${p.label}">
      <span class="nav-icon">${p.icon}</span>
      <span class="nav-label">${p.label}</span>
    </a>`;
  }).join('');

  return `
    <aside class="sidebar" id="ink-sidebar">
      <div class="logo">
        <span class="logo-icon">◈</span>
        <span class="logo-text">PROCTOR</span>
      </div>
      <nav class="nav">${nav}</nav>
      <div class="sidebar-footer">
        <button class="logout-btn" onclick="logout()">
          <span class="nav-icon">⇤</span>
          <span class="nav-label">Sign out</span>
        </button>
        <button class="sidebar-toggle-btn" onclick="toggleSidebar()"
          id="sidebar-toggle" title="Collapse sidebar">◀</button>
      </div>
    </aside>`;
}

function toggleSidebar() {
  const sidebar = document.getElementById('ink-sidebar');
  const btn     = document.getElementById('sidebar-toggle');
  if (!sidebar) return;
  const collapsed = sidebar.classList.toggle('collapsed');
  btn.textContent = collapsed ? '▶' : '◀';
  btn.title       = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0');
}

function applySidebarState() {
  if (localStorage.getItem('sidebar-collapsed') !== '1') return;
  const sidebar = document.getElementById('ink-sidebar');
  const btn     = document.getElementById('sidebar-toggle');
  if (!sidebar || !btn) return;
  sidebar.classList.add('collapsed');
  btn.textContent = '▶';
  btn.title       = 'Expand sidebar';
}

function initSidebar() {
  requestAnimationFrame(applySidebarState);
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}

async function api(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) { window.location.href = '/login'; return null; }
  return res.json();
}
````


### 7.1.3 public/penapp/index.html 
````html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Proctopen</title>
  <link rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=JetBrains+Mono:wght@400;600&family=Syne:wght@400;600;700&display=swap"/>
  <link rel="stylesheet" href="/penapp/style.css"/>
  <style>
    /* ── InkSentinel sidebar ──────────────────────────────── */
    :root {
      --is-accent: #00d4ff;
      --is-adim:   rgba(0,212,255,0.12);
      --is-border: rgba(0,212,255,0.10);
      --is-t2:     #8899aa;
      --is-t3:     #445566;
    }
    .ink-layout { display: flex; min-height: 100vh; }
    .ink-sidebar {
      width: 200px; min-width: 200px;
      background: #0d1117;
      border-right: 1px solid var(--is-border);
      display: flex; flex-direction: column; flex-shrink: 0;
      position: sticky; top: 0; height: 100vh; overflow: hidden;
      transition: width 0.2s ease, min-width 0.2s ease;
    }
    .ink-sidebar.collapsed { width: 52px; min-width: 52px; }
    .ink-sidebar.collapsed .ink-logo-text,
    .ink-sidebar.collapsed .ink-nav-label { display: none; }
    .ink-sidebar.collapsed .ink-logo { justify-content: center; padding: 22px 0; }
    .ink-sidebar.collapsed .ink-nav a { justify-content: center; padding: 10px 0; }
    .ink-sidebar.collapsed .ink-nav a.active {
      border-left: 2px solid var(--is-accent); padding-left: 0;
    }
    .ink-sidebar.collapsed .ink-sidebar-footer { padding: 10px 8px; }
    .ink-sidebar.collapsed .ink-logout-btn { justify-content: center; font-size: 0; padding: 8px 0; }
    .ink-sidebar.collapsed .ink-logout-btn .ink-nav-icon { font-size: 14px; }
    .ink-logo {
      display: flex; align-items: center; gap: 10px;
      padding: 22px 20px; border-bottom: 1px solid var(--is-border);
    }
    .ink-logo-icon { color: var(--is-accent); font-size: 20px; font-family: monospace; }
    .ink-logo-text {
      font-family: 'Barlow Condensed','Syne',sans-serif;
      font-weight: 800; font-size: 18px;
      letter-spacing: 0.18em; color: #e2e8f0; white-space: nowrap;
    }
    .ink-nav { flex: 1; padding: 12px 10px; display: flex; flex-direction: column; gap: 2px; }
    .ink-nav a {
      display: flex; align-items: center; gap: 9px;
      padding: 9px 12px; border-radius: 4px;
      color: var(--is-t2); font-size: 12px;
      font-family: 'JetBrains Mono', monospace; letter-spacing: 0.05em;
      text-decoration: none; transition: all 0.12s;
    }
    .ink-nav a:hover { color: #e2e8f0; background: var(--is-adim); }
    .ink-nav a.active {
      background: var(--is-adim); color: var(--is-accent);
      border-left: 2px solid var(--is-accent); padding-left: 10px;
    }
    .ink-nav-icon  { flex-shrink: 0; }
    .ink-nav-label { white-space: nowrap; overflow: hidden; }
    .ink-sidebar-footer {
      padding: 16px 20px; border-top: 1px solid var(--is-border);
      display: flex; flex-direction: column; gap: 6px;
    }
    .ink-logout-btn {
      width: 100%; display: flex; align-items: center; gap: 6px;
      padding: 7px 10px; background: transparent;
      border: 1px solid var(--is-border); border-radius: 4px;
      color: var(--is-t2); font-size: 11px; letter-spacing: 0.05em;
      cursor: pointer; font-family: 'JetBrains Mono', monospace; transition: all 0.12s;
    }
    .ink-logout-btn:hover { color: #e2e8f0; border-color: rgba(0,212,255,0.3); }
    .ink-toggle-btn {
      width: 100%; display: flex; align-items: center; justify-content: center;
      padding: 5px; background: transparent;
      border: 1px solid var(--is-border); border-radius: 4px;
      color: var(--is-t3); font-size: 10px; cursor: pointer;
      font-family: 'JetBrains Mono', monospace; transition: all 0.12s;
    }
    .ink-toggle-btn:hover { color: var(--is-accent); border-color: rgba(0,212,255,0.3); }

    .ink-pen-content { flex: 1; overflow-y: auto; min-width: 0; }
    .ink-pen-content .page { min-height: 100vh; }

    /* ── Alert border styles (applied by penapp-ext.js) ──── */
    .seat-cell { position: relative; transition: border-color 0.4s, box-shadow 0.4s; }
    .seat-cell.alert-moderate {
      border-color: #f59e0b !important;
      box-shadow: 0 0 0 2px rgba(245,158,11,0.25),
                  inset 0 0 0 1px rgba(245,158,11,0.15) !important;
    }
    .seat-cell.alert-high {
      border-color: #ef4444 !important;
      animation: alert-pulse 1.4s ease-in-out infinite;
    }
    @keyframes alert-pulse {
      0%,100% { box-shadow: 0 0 0 2px rgba(239,68,68,0.25); }
      50%      { box-shadow: 0 0 0 5px rgba(239,68,68,0.45); }
    }
    .seat-flag {
      position: absolute; top: 4px; right: 4px;
      font-size: 10px; font-family: 'JetBrains Mono', monospace;
      font-weight: 600; padding: 1px 5px; border-radius: 3px;
      letter-spacing: 0.06em; line-height: 1.4; pointer-events: none;
    }
    .seat-flag.moderate { background: rgba(245,158,11,0.2); color: #f59e0b; }
    .seat-flag.high     { background: rgba(239,68,68,0.2);  color: #ef4444; }

    /* ── Extended modal layout ───────────────────────────── */
    .modal { width: min(800px, 95vw) !important; max-height: 90vh; overflow-y: auto; }
    .modal-body-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 20px; margin-top: 12px;
    }

    /* Student search dropdown */
    .student-search-wrap { position: relative; margin-bottom: 8px; }
    .student-search-input {
      width: 100%; background: var(--bg3,#1a1a24);
      border: 1px solid var(--border,#26263a); border-radius: 6px;
      color: #e4e4f0; font-family: 'JetBrains Mono', monospace;
      font-size: 13px; padding: 8px 10px; outline: none; box-sizing: border-box;
    }
    .student-search-input:focus { border-color: #00d4ff; }
    .student-dropdown {
      position: absolute; top: 100%; left: 0; right: 0;
      background: #13131a; border: 1px solid #26263a; border-radius: 6px;
      max-height: 200px; overflow-y: auto; z-index: 300;
      margin-top: 2px; display: none;
    }
    .student-dropdown.open { display: block; }
    .student-option {
      display: flex; justify-content: space-between; align-items: center;
      padding: 9px 12px; cursor: pointer;
      border-bottom: 1px solid #1a1a24; font-size: 12px;
    }
    .student-option:last-child { border-bottom: none; }
    .student-option:hover { background: rgba(0,212,255,0.08); }
    .student-option-name { color: #e4e4f0; font-weight: 600; }
    .student-option-id   { color: #8899aa; font-family: 'JetBrains Mono',monospace; font-size: 11px; }

    /* Selected / assigned student panels */
    .selected-student-panel {
      background: rgba(0,212,255,0.05);
      border: 1px solid rgba(0,212,255,0.12);
      border-radius: 8px; padding: 14px; margin-top: 4px;
    }
    .selected-student-name { font-size: 15px; font-weight: 700; color: #e4e4f0; margin-bottom: 4px; }
    .selected-student-id   { font-family: 'JetBrains Mono',monospace; font-size: 12px; color: #00d4ff; }
    .selected-student-meta { font-size: 11px; color: #8899aa; margin-top: 6px; line-height: 1.6; }

    /* Camera feed box */
    .modal-cam-section { display: flex; flex-direction: column; gap: 8px; }
    .modal-cam-input-row { display: flex; gap: 6px; }
    .modal-cam-input-row input {
      flex: 1; background: #1a1a24; border: 1px solid #26263a;
      border-radius: 6px; color: #e4e4f0;
      font-family: 'JetBrains Mono',monospace; font-size: 13px;
      padding: 7px 10px; text-transform: uppercase; letter-spacing: 0.06em;
    }
    .modal-video-box {
      width: 100%; aspect-ratio: 4/3; background: #0d1117;
      border-radius: 8px; overflow: hidden; position: relative;
      display: flex; align-items: center; justify-content: center;
    }
    .modal-video-placeholder {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 8px;
      color: #445566; font-size: 11px;
      font-family: 'JetBrains Mono',monospace; letter-spacing: 0.08em;
    }
    .modal-live-badge {
      position: absolute; top: 8px; left: 8px;
      background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.4);
      color: #22c55e; font-size: 9px; font-family: 'JetBrains Mono',monospace;
      font-weight: 600; padding: 2px 7px; border-radius: 3px;
      letter-spacing: 0.10em; display: none;
    }
    .cam-id-hint-text { font-size: 10px; color: #445566; line-height: 1.5; }

    /* DB status chip */
    #db-chip    { display: none; }
    #alert-chip { display: none; }
  </style>
</head>
<body>

<div class="ink-layout">

  <!-- ── Sidebar ─────────────────────────────────────────── -->
  <aside class="ink-sidebar" id="ink-sidebar">
    <div class="ink-logo">
      <span class="ink-logo-icon">◈</span>
      <span class="ink-logo-text">PROCTOR</span>
    </div>
    <nav class="ink-nav">
      <a href="/dashboard">
        <span class="ink-nav-icon">⊞</span>
        <span class="ink-nav-label">Dashboard</span>
      </a>
      <a href="/session">
        <span class="ink-nav-icon">◎</span>
        <span class="ink-nav-label">Session</span>
      </a>
      <a href="/allsessions">
        <span class="ink-nav-icon">☰</span>
        <span class="ink-nav-label">All Sessions</span>
      </a>
      <a href="/incidents">
        <span class="ink-nav-icon">△</span>
        <span class="ink-nav-label">Incidents</span>
      </a>
      <a href="/history">
        <span class="ink-nav-icon">◷</span>
        <span class="ink-nav-label">Sig. History</span>
      </a>
      <a href="/pen" class="active">
        <span class="ink-nav-icon">✒</span>
        <span class="ink-nav-label">Pen Control</span>
      </a>
      <a href="/students-list">
        <span class="ink-nav-icon">☰</span>
        <span class="ink-nav-label">Students</span>
      </a>
    </nav>
    <div class="ink-sidebar-footer">
      <button class="ink-logout-btn" onclick="doLogout()">
        <span class="ink-nav-icon">⇤</span>
        <span class="ink-nav-label">Sign out</span>
      </button>
      <button class="ink-toggle-btn" id="ink-toggle" onclick="toggleSidebar()">◀</button>
    </div>
  </aside>

  <!-- ── App content ─────────────────────────────────────── -->
  <div class="ink-pen-content">

    <!-- PAGE 1 — Landing (unchanged from Shams's version) -->
    <div id="page-landing" class="page">
      <div class="landing-wrap">
        <div class="landing-head">
          <div class="brand">Proctopen</div>
          <button class="theme-pill" id="theme-btn-1">Toggle theme</button>
        </div>
        <p class="landing-sub">Select how you are connecting to the central unit</p>
        <div class="mode-grid">
          <button class="mode-card" data-pick="ble">
            <span class="mode-icon">⬡</span>
            <span class="mode-title">Bluetooth</span>
            <span class="mode-desc">Connect via Web Bluetooth. Chrome/Edge only.</span>
          </button>
          <button class="mode-card" data-pick="ap">
            <span class="mode-icon">◈</span>
            <span class="mode-title">WiFi — Access Point</span>
            <span class="mode-desc">ESP32 hosts its own hotspot. Join <code>Proctopen</code>.</span>
          </button>
          <button class="mode-card" data-pick="sta">
            <span class="mode-icon">◎</span>
            <span class="mode-title">WiFi — Station</span>
            <span class="mode-desc">ESP32 joins your router. Same network required.</span>
          </button>
          <button class="mode-card" data-pick="usb"
            style="border-color:rgba(0,212,255,0.4)">
            <span class="mode-icon" style="color:#00d4ff">⬡</span>
            <span class="mode-title" style="color:#00d4ff">USB Serial ★ Recommended</span>
            <span class="mode-desc">Most reliable for demo. Chrome/Edge + USB cable required.</span>
          </button>

          <button class="mode-card" id="btn-mock"
            style="border-color:rgba(124,111,255,0.4)">
            <span class="mode-icon" style="color:#7c6fff">🧪</span>
            <span class="mode-title" style="color:#7c6fff">Simulator Mode</span>
            <span class="mode-desc">Test the UI without hardware. 4 mock units are auto-connected.</span>
          </button>
        </div>
      </div>
    </div>

    <!-- PAGE 2 — Setup (unchanged from Shams's version) -->
    <div id="page-setup" class="page hidden">
      <div class="setup-wrap">
        <div class="setup-topbar">
          <button class="back-btn" id="back-btn">← Back</button>
          <span class="brand small">Proctopen</span>
          <button class="theme-pill" id="theme-btn-2">Toggle theme</button>
        </div>
        <div id="sec-ble" class="setup-sec hidden">
          <h1>Bluetooth</h1>
          <ol class="steps">
            <li>Press mode button on ESP32 until OLED shows <code>[Bluetooth]</code>.</li>
            <li>Click Scan &amp; Connect and select <strong>Proctopen</strong>.</li>
          </ol>
          <button class="btn-primary wide" id="ble-btn">Scan &amp; Connect</button>
        </div>
        <div id="sec-ap" class="setup-sec hidden">
          <h1>WiFi — Access Point</h1>
          <ol class="steps">
            <li>Press mode button until OLED shows <code>[WiFi AP]</code>.</li>
            <li>Join WiFi <code>Proctopen</code> (password: <code>proctopen123</code>).</li>
          </ol>
          <button class="btn-primary wide" id="ap-btn">Connect</button>
        </div>
        <div id="sec-sta" class="setup-sec hidden">
          <h1>WiFi — Station</h1>
          <ol class="steps">
            <li>Press mode button until OLED shows <code>[WiFi STA]</code>.</li>
            <li>Connect this device to the same router.</li>
          </ol>
          <button class="btn-primary wide" id="sta-btn">Connect</button>
        </div>
        <div id="sec-usb" class="setup-sec hidden">
          <h1>USB Serial</h1>
          <ol class="steps">
            <li>Press mode button until OLED shows <code>[USB Serial]</code>.</li>
            <li>Connect ESP32 via USB cable.</li>
            <li>Click Connect — pick ESP32 port from browser popup.</li>
          </ol>
          <div class="info-note">Requires <strong>Chrome or Edge</strong>. Firefox/Safari not supported.</div>
          <button class="btn-primary wide" id="usb-btn">Connect</button>
        </div>
        <div id="sec-exam-config" class="setup-sec hidden">
          <h2 class="setup-section-title">Exam configuration</h2>
          <div class="exam-mode-toggle">
            <span class="toggle-label">Roll Call</span>
            <label class="toggle-switch">
              <input type="checkbox" id="mode-toggle"/>
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Fixed Wemos</span>
          </div>
          <div class="grid-config">
            <label class="field-label">Grid size</label>
            <div class="grid-size-inputs">
              <input id="grid-rows" type="number" min="1" max="20" value="3" title="Rows"/>
              <span class="dur-sep">rows ×</span>
              <input id="grid-cols" type="number" min="1" max="20" value="4" title="Columns"/>
              <span class="dur-sep">cols</span>
            </div>
            <p class="field-hint">Row 1 is front of room.</p>
          </div>
        </div>
        <div class="status-row" id="setup-status-row">
          <span class="dot" id="setup-dot"></span>
          <span id="setup-status-text">Not connected</span>
        </div>
      </div>
    </div>

    <!-- PAGE 3 — Dashboard (unchanged from Shams's version) -->
    <div id="page-dash" class="page hidden">
      <header>
        <div class="header-left">
          <span class="brand small">Proctopen</span>
          <span class="chip" id="mode-chip">—</span>
          <span class="chip" id="sta-chip" style="display:none">STA ✓</span>
          <span class="chip" id="exam-mode-chip">—</span>
          <!-- These two chips are managed by penapp-ext.js -->
          <span class="chip" id="db-chip" style="color:#22c55e">DB ✓</span>
          <span class="chip" id="alert-chip">
            ⚠ <span id="alert-count">0</span> alerts
          </span>
        </div>
        <div class="header-right">
          <span class="dot connected" id="hdr-dot"></span>
          <button class="btn-ghost small" id="disconnect-btn">Disconnect</button>
          <button class="theme-pill" id="theme-btn-3">Theme</button>
        </div>
      </header>

      <main>
        <section class="card">
          <h2 class="card-title">Exam</h2>
          <div class="duration-row">
            <div class="dur-group">
              <label class="field-label">Duration</label>
              <div class="dur-inputs">
                <input id="inp-h" type="number" min="0" max="23" value="0" title="Hours"/>
                <span class="dur-sep">h</span>
                <input id="inp-m" type="number" min="0" max="59" value="90" title="Minutes"/>
                <span class="dur-sep">m</span>
                <input id="inp-s" type="number" min="0" max="59" value="0" title="Seconds"/>
                <span class="dur-sep">s</span>
              </div>
            </div>
            <button class="btn-secondary" id="set-timer-btn">Set Timer</button>
          </div>
          <div class="big-timer" id="big-timer">--:--</div>
          <div class="exam-btns">
            <button class="btn-green" id="start-btn">▶ Start</button>
            <button class="btn-amber" id="pause-btn">⏸ Pause</button>
            <button class="btn-red"   id="end-btn">⏹ End</button>
            <button class="btn-ghost" id="reset-btn">↺ Reset</button>
          </div>
        </section>

        <section class="card" id="grid-section">
          <div class="card-titlebar">
            <h2 class="card-title">
              Seat grid <span class="chip" id="unit-count">0</span>
            </h2>
            <div class="grid-header-right">
              <span class="field-hint" id="grid-hint">Drag unassigned units into seats</span>
            </div>
          </div>
          <div id="unassigned-tray" class="unassigned-tray">
            <span class="tray-label">Unassigned</span>
            <div id="tray-units" class="tray-units"></div>
          </div>
          <div class="proctor-row"><span>▲ Proctor / Front of room</span></div>
          <div id="seat-grid" class="seat-grid"></div>
        </section>

        <section class="card">
          <h2 class="card-title">Raw command</h2>
          <p class="field-hint">Send any JSON directly — for testing.</p>
          <div class="input-row">
            <input id="raw-inp" type="text" placeholder='{"cmd":"warn","device_id":1}'/>
            <button class="btn-primary" id="raw-btn">Send</button>
          </div>
        </section>

        <section class="card">
          <div class="card-titlebar">
            <h2 class="card-title">Log</h2>
            <button class="btn-ghost small" id="clear-log-btn">Clear</button>
          </div>
          <div id="log"></div>
        </section>
      </main>
    </div>

  </div><!-- /ink-pen-content -->
</div><!-- /ink-layout -->


<!-- ════════════════════════════════════════════════════════
     MODAL — extended with student search + camera feed.
     The modal-head, action buttons, and close logic are
     wired by app.js. penapp-ext.js adds extra behaviour
     via MutationObserver — no app.js changes needed.
════════════════════════════════════════════════════════ -->
<div id="modal-bg" class="modal-bg hidden">
  <div class="modal">

    <div class="modal-head">
      <div>
        <h3 id="modal-title">Unit actions</h3>
        <p id="modal-subtitle" class="modal-subtitle"></p>
      </div>
      <button class="icon-btn" id="modal-close">✕</button>
    </div>

    <!-- Roll call: student info (app.js shows/hides this).
         modal-photo and modal-photo-placeholder MUST exist in DOM —
         app.js accesses them unconditionally in openModal().
         They are hidden here; the visible student info is in the
         two-column layout below, managed by penapp-ext.js. -->
    <div id="modal-student-info" class="modal-student-info hidden">
      <!-- Required ghost elements — app.js crashes without these -->
      <img id="modal-photo" src="" alt="" class="student-photo hidden"
        style="display:none"/>
      <span id="modal-photo-placeholder" class="photo-placeholder hidden"
        style="display:none"></span>
      <div class="student-fields">
        <div class="student-field">
          <label class="field-label">Name</label>
          <input id="modal-name" type="text" placeholder="Student name"/>
        </div>
        <div class="student-field">
          <label class="field-label">ID</label>
          <input id="modal-student-id" type="text" placeholder="Student ID"/>
        </div>
        <button class="btn-secondary small" id="modal-save-student">Save</button>
      </div>
    </div>

    <!-- Fixed mode: read-only (app.js shows/hides this) -->
    <div id="modal-fixed-info" class="modal-student-info hidden">
      <div class="student-photo-wrap">
        <img id="modal-fixed-photo" src="" alt="" class="student-photo"/>
      </div>
      <div class="student-fields">
        <p class="fixed-name" id="modal-fixed-name">—</p>
        <p class="fixed-id"   id="modal-fixed-id">—</p>
      </div>
    </div>

    <!-- ── Extended two-column layout (penapp-ext.js manages) -->
    <div class="modal-body-grid">

      <!-- Left: DB student search + unit actions -->
      <div>
        <p class="field-label" style="margin-bottom:8px">Search students</p>

        <div class="student-search-wrap">
          <input class="student-search-input" id="student-search"
            type="text" placeholder="Type name or ID..." autocomplete="off"/>
          <div class="student-dropdown" id="student-dropdown"></div>
        </div>

        <!-- After searching: selected student to confirm -->
        <div class="selected-student-panel" id="selected-panel" style="display:none">
          <div class="selected-student-name" id="sel-name">—</div>
          <div class="selected-student-id"   id="sel-id">—</div>
          <div class="selected-student-meta" id="sel-meta">—</div>
          <div style="display:flex;gap:6px;margin-top:10px">
            <button class="btn-secondary small" id="assign-student-btn">✓ Assign</button>
            <button class="btn-ghost small"     id="clear-student-btn">✕ Clear</button>
          </div>
        </div>

        <!-- Already assigned student -->
        <div id="assigned-student-panel" style="display:none;margin-top:6px">
          <div class="selected-student-panel">
            <div class="selected-student-name" id="assigned-name">—</div>
            <div class="selected-student-id"   id="assigned-id">—</div>
            <button class="btn-ghost small" id="remove-student-btn"
              style="margin-top:8px">✕ Remove student</button>
          </div>
        </div>

        <!-- Divider -->
        <hr style="border:none;border-top:1px solid #26263a;margin:14px 0"/>

        <!-- Unit action buttons (wired by app.js, logged by penapp-ext.js) -->
        <div class="modal-body">
          <div class="modal-row">
            <div class="modal-row-label">
              <strong>Warn</strong><span>Shows WARNING on unit</span>
            </div>
            <button class="btn-amber" id="m-warn-btn">⚠ Warn</button>
          </div>
          <div class="modal-row">
            <div class="modal-row-label">
              <strong>Disable</strong><span>0 s = indefinite</span>
            </div>
            <div class="modal-row-right">
              <input id="m-punish" type="number" min="0" placeholder="Penalty (s)"/>
              <button class="btn-red" id="m-disable-btn">Disable</button>
            </div>
          </div>
          <div class="modal-row">
            <div class="modal-row-label">
              <strong>Enable</strong><span>Re-enable immediately</span>
            </div>
            <button class="btn-green" id="m-enable-btn">✓ Enable</button>
          </div>
          <div class="modal-row">
            <div class="modal-row-label">
              <strong>Deduct time</strong><span>Reduces unit timer</span>
            </div>
            <div class="modal-row-right">
              <input id="m-deduct" type="number" min="1" placeholder="Seconds"/>
              <button class="btn-red" id="m-deduct-btn">Deduct</button>
            </div>
          </div>
          <div class="modal-row">
            <div class="modal-row-label">
              <strong>Beep</strong><span>Flash BEEP to identify unit</span>
            </div>
            <button class="btn-secondary" id="m-beep-btn">📣 Beep</button>
          </div>
        </div>
      </div>

      <!-- Right: live camera feed -->
      <div class="modal-cam-section">
        <p class="field-label" style="margin-bottom:8px">Live camera feed</p>

        <div class="modal-cam-input-row">
          <input id="modal-cam-id" type="text"
            placeholder="Cam ID — e.g. CAM-A1B2"/>
          <button class="btn-secondary" id="modal-link-cam-btn"
            style="font-size:12px;white-space:nowrap">Link</button>
        </div>
        <p class="cam-id-hint-text">
          The camera page shows an 8-char ID. Enter it here to link
          this seat's live feed.
        </p>

        <div class="modal-video-box" id="modal-video-box">
          <div class="modal-video-placeholder" id="modal-video-placeholder">
            <span style="font-size:28px;opacity:0.3">◈</span>
            <span>No camera linked</span>
          </div>
          <img id="modal-live-img" src="" alt=""
            style="display:none;width:100%;height:100%;object-fit:cover"/>
          <div class="modal-live-badge" id="modal-live-badge">● LIVE</div>
        </div>

        <div id="modal-cam-status"
          style="font-size:11px;font-family:'JetBrains Mono',monospace;
                 color:#445566;margin-top:4px">
        </div>
      </div>

    </div><!-- /modal-body-grid -->
  </div>
</div>

<!-- app.js (v5) loads first — NEVER modify app.js directly.
     penapp-ext.js attaches all extra behaviour via observers. -->
<script src="/penapp/app.js"></script>
<script type="module" src="/penapp/penapp-ext.js"></script>
<!-- simscript.js is no longer needed — use Simulator Mode button instead -->

</body>
</html>
```` 
### 7.1.4 public/penapp/app.js  
````js
// ============================================================
//  Proctopen — app.js  v5
//  Changes from v4:
//  - Seats NOT saved/restored across sessions (fresh every time)
//  - Student name/photo still persists across sessions
//  - Dragging unit onto occupied cell swaps the two units
//  - Drag occupied cell back to tray to unassign
//  - ↕ Move button on each cell for click-to-move workflow
//  - Units marked inactive on disconnect (not removed)
// ============================================================

const BLE_SVC = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_RX  = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_TX  = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

// ── Dummy student database (Fixed Wemos mode) ────────────────
const STUDENT_DB = [
  { mac: 'AA:BB:CC:DD:EE:01', name: 'Alek Rahman',   id: 'STU-001', photo: 'https://i.pravatar.cc/150?img=1' },
  { mac: 'AA:BB:CC:DD:EE:02', name: 'Sara Ahmed',    id: 'STU-002', photo: 'https://i.pravatar.cc/150?img=5' },
  { mac: 'AA:BB:CC:DD:EE:03', name: 'Karim Hossain', id: 'STU-003', photo: 'https://i.pravatar.cc/150?img=8' },
];

// ── App state ────────────────────────────────────────────────
const S = {
  connMode:    null,
  examMode:    'roll',
  connected:   false,
  remainingMs: 0,
  running:     false,
  paused:      false,
  gridRows:    3,
  gridCols:    4,
  units:       {},   // mac → { id, mac, status, via, seatNumber, studentName, studentId, studentPhoto }
  seats:       {},   // seatNumber → mac
  activeUnit:  null, // mac of unit in modal
  dragMac:     null, // mac being dragged
  moveMac:     null, // mac in click-to-move mode
};

// ── Storage keys (only student info persists, not seats) ─────
const STORAGE_STUDENTS = 'proctopen-students';

// ── Transport ────────────────────────────────────────────────
let ws           = null;
let ble          = { device: null, rx: null, tx: null };
let serialPort   = null;
let serialReader = null;
let serialWriter = null;

// ── Timer ────────────────────────────────────────────────────
let ticker   = null;
let lastTick = 0;

// ── DOM ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const E = {
  pageLanding:   $('page-landing'),
  pageSetup:     $('page-setup'),
  pageDash:      $('page-dash'),
  modeCards:     document.querySelectorAll('.mode-card'),
  backBtn:       $('back-btn'),
  secBle:        $('sec-ble'),
  secAp:         $('sec-ap'),
  secSta:        $('sec-sta'),
  secUsb:        $('sec-usb'),
  secExamConfig: $('sec-exam-config'),
  bleBtn:        $('ble-btn'),
  apBtn:         $('ap-btn'),
  staBtn:        $('sta-btn'),
  usbBtn:        $('usb-btn'),
  modeToggle:    $('mode-toggle'),
  gridRows:      $('grid-rows'),
  gridCols:      $('grid-cols'),
  setupDot:      $('setup-dot'),
  setupStatus:   $('setup-status-text'),
  modeChip:      $('mode-chip'),
  staChip:       $('sta-chip'),
  examModeChip:  $('exam-mode-chip'),
  hdrDot:        $('hdr-dot'),
  disconnBtn:    $('disconnect-btn'),
  inpH:          $('inp-h'),
  inpM:          $('inp-m'),
  inpS:          $('inp-s'),
  setTimerBtn:   $('set-timer-btn'),
  bigTimer:      $('big-timer'),
  startBtn:      $('start-btn'),
  pauseBtn:      $('pause-btn'),
  endBtn:        $('end-btn'),
  resetBtn:      $('reset-btn'),
  unitCount:     $('unit-count'),
  trayUnits:     $('tray-units'),
  seatGrid:      $('seat-grid'),
  gridHint:      $('grid-hint'),
  rawInp:        $('raw-inp'),
  rawBtn:        $('raw-btn'),
  log:           $('log'),
  clearLogBtn:   $('clear-log-btn'),
  modalBg:       $('modal-bg'),
  modalTitle:    $('modal-title'),
  modalSubtitle: $('modal-subtitle'),
  modalClose:    $('modal-close'),
  modalStudentInfo:      $('modal-student-info'),
  modalFixedInfo:        $('modal-fixed-info'),
  modalPhoto:            $('modal-photo'),
  modalPhotoPlaceholder: $('modal-photo-placeholder'),
  modalName:             $('modal-name'),
  modalStudentId:        $('modal-student-id'),
  modalSaveStudent:      $('modal-save-student'),
  modalFixedPhoto:       $('modal-fixed-photo'),
  modalFixedName:        $('modal-fixed-name'),
  modalFixedId:          $('modal-fixed-id'),
  mBeepBtn:    $('m-beep-btn'),
  mWarnBtn:    $('m-warn-btn'),
  mDisableBtn: $('m-disable-btn'),
  mEnableBtn:  $('m-enable-btn'),
  mDeductBtn:  $('m-deduct-btn'),
  mPunish:     $('m-punish'),
  mDeduct:     $('m-deduct'),
};

// ============================================================
//  Theme
// ============================================================
function toggleTheme() {
  const html = document.documentElement;
  html.setAttribute('data-theme',
    html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}
['theme-btn-1','theme-btn-2','theme-btn-3'].forEach(id => {
  $(id)?.addEventListener('click', toggleTheme);
});

// ============================================================
//  Student info persistence (seats are NOT persisted)
// ============================================================
function loadStudentInfo() {
  try {
    const raw = localStorage.getItem(STORAGE_STUDENTS);
    if (!raw) return;
    const saved = JSON.parse(raw);
    Object.keys(saved).forEach(mac => {
      if (!S.units[mac]) S.units[mac] = { mac, status: 'offline' };
      S.units[mac].studentName  = saved[mac].name;
      S.units[mac].studentId    = saved[mac].id;
      S.units[mac].studentPhoto = saved[mac].photo;
    });
  } catch(e) {}
}

function saveStudentInfo(mac, name, id, photo) {
  try {
    const raw  = localStorage.getItem(STORAGE_STUDENTS);
    const data = raw ? JSON.parse(raw) : {};
    data[mac]  = { name, id, photo: photo || '' };
    localStorage.setItem(STORAGE_STUDENTS, JSON.stringify(data));
  } catch(e) {}
}

// ============================================================
//  Page navigation
// ============================================================
function showPage(name) {
  [E.pageLanding, E.pageSetup, E.pageDash].forEach(p =>
    p.classList.add('hidden'));
  ({ landing: E.pageLanding, setup: E.pageSetup, dash: E.pageDash })[name]
    .classList.remove('hidden');
}

E.modeCards.forEach(card => {
  card.addEventListener('click', () => {
    S.connMode = card.dataset.pick;
    [E.secBle, E.secAp, E.secSta, E.secUsb].forEach(s => s.classList.add('hidden'));
    ({ ble: E.secBle, ap: E.secAp, sta: E.secSta, usb: E.secUsb })[S.connMode]
      ?.classList.remove('hidden');
    E.secExamConfig.classList.remove('hidden');
    setSetupStatus('', 'Not connected');
    showPage('setup');
  });
});

E.backBtn.addEventListener('click', () => { disconnect(); showPage('landing'); });

// ============================================================
//  Connect buttons
// ============================================================
E.bleBtn.addEventListener('click', connectBLE);
E.apBtn.addEventListener('click',  () => connectWS('proctopen.local'));
E.staBtn.addEventListener('click', () => connectWS('proctopen.local'));
E.usbBtn.addEventListener('click', connectUSB);

// ============================================================
//  WebSocket
// ============================================================
function connectWS(host) {
  setSetupStatus('connecting', `Connecting to ${host}…`);
  try {
    ws = new WebSocket(`ws://${host}/ws`);
    ws.onopen    = () => { send({ cmd: 'set_mode', mode: S.connMode }); onConnected(); };
    ws.onmessage = e => onMessage(e.data);
    ws.onerror   = () => { log('err', 'WebSocket error'); disconnect(); };
    ws.onclose   = () => { if (S.connected) { disconnect(); log('sys', 'Connection closed'); } };
  } catch(e) {
    log('err', 'WebSocket failed: ' + e.message);
    setSetupStatus('', 'Connection failed');
  }
}

// ============================================================
//  BLE
// ============================================================
async function connectBLE() {
  if (!navigator.bluetooth) {
    log('err', 'Web Bluetooth not supported. Use Chrome or Edge.'); return;
  }
  try {
    setSetupStatus('connecting', 'Scanning for Proctopen…');
    ble.device = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'Proctopen' }], optionalServices: [BLE_SVC],
    });
    ble.device.addEventListener('gattserverdisconnected', () => {
      log('sys', 'BLE disconnected'); disconnect();
    });
    const server  = await ble.device.gatt.connect();
    const service = await server.getPrimaryService(BLE_SVC);
    ble.rx = await service.getCharacteristic(BLE_RX);
    ble.tx = await service.getCharacteristic(BLE_TX);
    await ble.tx.startNotifications();
    ble.tx.addEventListener('characteristicvaluechanged', e =>
      onMessage(new TextDecoder().decode(e.target.value)));
    onConnected();
  } catch(e) {
    log('err', 'BLE error: ' + e.message);
    setSetupStatus('', 'Bluetooth failed');
  }
}

// ============================================================
//  USB Serial
// ============================================================
async function connectUSB() {
  if (!navigator.serial) {
    log('err', 'Web Serial not supported. Use Chrome or Edge.'); return;
  }
  try {
    setSetupStatus('connecting', 'Selecting serial port…');
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 115200 });
    serialWriter = serialPort.writable.getWriter();

    const decoder = new TextDecoderStream();
    serialPort.readable.pipeTo(decoder.writable);
    serialReader = decoder.readable.getReader();

    (async () => {
      let buf = '';
      try {
        while (true) {
          const { value, done } = await serialReader.read();
          if (done) break;
          buf += value;
          let nl;
          while ((nl = buf.indexOf('\n')) !== -1) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (line) onMessage(line);
          }
        }
      } catch(e) {
        if (S.connected) { log('sys', 'USB disconnected'); disconnect(); }
      }
    })();

    onConnected();
  } catch(e) {
    log('err', 'USB Serial failed: ' + e.message);
    setSetupStatus('', 'Connection failed');
  }
}

// ============================================================
//  Connected / Disconnected
// ============================================================
function onConnected() {
  S.connected = true;
  S.examMode  = E.modeToggle.checked ? 'fixed' : 'roll';
  S.gridRows  = parseInt(E.gridRows.value) || 3;
  S.gridCols  = parseInt(E.gridCols.value) || 4;

  // Fresh session — no seat assignments, no unit state
  S.seats   = {};
  S.units   = {};
  S.dragMac = null;
  S.moveMac = null;

  // Load only student name/photo info (not seats)
  loadStudentInfo();
  buildGrid();





  const labels = { ble: 'Bluetooth', ap: 'WiFi AP', sta: 'WiFi STA', usb: 'USB' };
  E.modeChip.textContent     = labels[S.connMode] || S.connMode;
  E.examModeChip.textContent = S.examMode === 'fixed' ? 'Fixed' : 'Roll Call';
  log('sys', `Connected — ${labels[S.connMode]} — ${S.examMode === 'fixed' ? 'Fixed Wemos' : 'Roll Call'}`);
  showPage('dash');


}

function disconnect() {
  S.connected = false;
  S.running   = false;
  stopTicker();

  if (ws) { try { ws.close(); } catch(e) {} ws = null; }
  if (ble.device?.gatt?.connected) {
    try { ble.device.gatt.disconnect(); } catch(e) {}
  }
  ble = { device: null, rx: null, tx: null };

  if (serialReader) { try { serialReader.cancel(); } catch(e) {} serialReader = null; }
  if (serialWriter) { try { serialWriter.releaseLock(); } catch(e) {} serialWriter = null; }
  if (serialPort)   { try { serialPort.close(); } catch(e) {} serialPort = null; }

  E.modeChip.textContent  = '—';
  E.staChip.style.display = 'none';
  showPage('setup');
  setSetupStatus('', 'Disconnected');
}

E.disconnBtn.addEventListener('click', () => { disconnect(); showPage('landing'); });

// ============================================================
//  Send JSON
// ============================================================
async function send(obj) {
  if (!S.connected) { log('err', 'Not connected'); return false; }
  const json = JSON.stringify(obj);
  try {
    if (S.connMode === 'usb' && serialWriter) {
      await serialWriter.write(new TextEncoder().encode(json + '\n'));
    } else if (S.connMode !== 'ble' && ws?.readyState === WebSocket.OPEN) {
      ws.send(json);
    } else if (S.connMode === 'ble' && ble.rx) {
      ble.rx.writeValueWithoutResponse(new TextEncoder().encode(json));
    } else {
      log('err', 'Transport not ready'); return false;
    }
    log('out', json);
    return true;
  } catch(e) {
    log('err', 'Send error: ' + e.message); return false;
  }
}

// ============================================================
//  Receive message from ESP32
// ============================================================
function onMessage(raw) {
  raw = raw.trim();
  if (!raw) return;
  log('in', raw);

  let msg;
  try { msg = JSON.parse(raw); } catch(e) { return; }

  switch (msg.event) {

    case 'heartbeat':
      if (msg.mode) E.modeChip.textContent = msg.mode;
      if (msg.sta_connected === true) E.staChip.style.display = '';
      if (S.running && typeof msg.remaining_ms === 'number') {
        if (Math.abs(msg.remaining_ms - S.remainingMs) > 1000)
          S.remainingMs = msg.remaining_ms;
      }
      if (Array.isArray(msg.units)) {
        const liveMacs = msg.units.map(u => u.mac).filter(Boolean);
        
        msg.units.forEach(u => {
          if (!u.mac) return;
          if (!S.units[u.mac]) S.units[u.mac] = { mac: u.mac };
          if (u.id) S.units[u.mac].id = u.id;
          S.units[u.mac].status = 'active';
        });

        Object.keys(S.units).forEach(mac => {
          if (!liveMacs.includes(mac) && S.units[mac].status === 'active')
            S.units[mac].status = 'inactive';
        });
        
        // Only re-render if the user isn't moving something
        if (!S.dragMac && !S.moveMac) {
            renderGrid();
        }
      }
      break;

    case 'wemos_connected': {
      const mac = msg.mac;
      if (!mac) break;
      if (!S.units[mac]) S.units[mac] = { mac };
      S.units[mac].id     = msg.id;
      S.units[mac].via    = msg.via;
      S.units[mac].status = 'active';
      maybeAutoPlace(mac);
      renderGrid();
      log('sys', `Unit #${msg.id} (${mac}) connected via ${msg.via}`);
      break;
    }

    case 'wemos_disconnected': {
      const mac = msg.mac;
      if (mac && S.units[mac]) {
        S.units[mac].status = 'inactive';
        renderGrid();
      }
      log('sys', `Unit #${msg.id} (${mac || '?'}) disconnected`);
      break;
    }

    case 'started':
      S.running = true; S.paused = false;
      E.bigTimer.classList.remove('warning', 'ended');
      startTicker();
      break;

    case 'paused':
      S.running = false; S.paused = true;
      stopTicker();
      break;

    case 'ended':
    case 'timeup':
      S.running = false; S.paused = false;
      S.remainingMs = 0;
      stopTicker(); renderTimer();
      E.bigTimer.classList.add('ended');
      break;

    case 'reset':
      S.running = false; S.paused = false;
      S.remainingMs = 0;
      stopTicker(); renderTimer();
      E.bigTimer.classList.remove('warning', 'ended');
      break;

    case 'wifi_forgotten':
      log('sys', 'WiFi credentials cleared on ESP32');
      E.staChip.style.display = 'none';
      break;
  }
}

// ============================================================
//  Auto-place (fixed mode only — roll call is always manual)
// ============================================================
function maybeAutoPlace(mac) {
  if (S.units[mac]?.seatNumber) return; // already seated

  if (S.examMode === 'fixed') {
    const student = STUDENT_DB.find(s => s.mac === mac);
    if (student) {
      S.units[mac].studentName  = student.name;
      S.units[mac].studentId    = student.id;
      S.units[mac].studentPhoto = student.photo;
      const total = S.gridRows * S.gridCols;
      for (let seat = 1; seat <= total; seat++) {
        if (!S.seats[seat]) { assignSeat(mac, seat); break; }
      }
    }
  }
}

// ============================================================
//  Seat assignment — supports swap
//  If targetSeat is already occupied, the two units swap.
// ============================================================
function assignSeat(mac, targetSeat) {
  const existingMac = S.seats[targetSeat] || null;

  // Find where mac currently sits (if anywhere)
  const currentSeat = S.units[mac]?.seatNumber || null;

  if (existingMac && existingMac !== mac) {
    // Swap: put existing unit into mac's old seat (or unassign if mac had none)
    if (currentSeat) {
      S.seats[currentSeat]              = existingMac;
      S.units[existingMac].seatNumber   = currentSeat;
      // Tell Wemos its new seat
      if (S.units[existingMac].id && S.units[existingMac].status === 'active')
        send({ cmd: 'seat', device_id: S.units[existingMac].id, number: currentSeat });
    } else {
      // Mac was unassigned — existing unit becomes unassigned
      // delete S.seats[currentSeat];
      S.units[existingMac].seatNumber = null;
    }
  } else if (currentSeat) {
    // Just moving — clear old seat
    delete S.seats[currentSeat];
  }

  // Place mac in target seat
  S.seats[targetSeat]      = mac;
  S.units[mac].seatNumber  = targetSeat;

  // Tell Wemos its seat number
  if (S.units[mac].id && S.units[mac].status === 'active')
    send({ cmd: 'seat', device_id: S.units[mac].id, number: targetSeat });
}

function unassignSeat(mac) {
  const unit = S.units[mac];
  if (!unit) return;
  if (unit.seatNumber) {
    delete S.seats[unit.seatNumber];
  }
  unit.seatNumber = null;
}

// ============================================================
//  Cancel move mode
// ============================================================
function cancelMoveMode() {
  S.moveMac = null;
  E.seatGrid.querySelectorAll('.seat-cell')
    .forEach(c => c.classList.remove('move-target'));
  E.trayUnits.classList.remove('move-target');
}

// ============================================================
//  Build grid (called once on connect)
// ============================================================
function buildGrid() {
  const grid = E.seatGrid;
  grid.style.gridTemplateColumns = `repeat(${S.gridCols}, 1fr)`;
  grid.innerHTML = '';

  // Rows rendered high→low so row 1 appears at bottom (closest to proctor)
  for (let row = S.gridRows; row >= 1; row--) {
    for (let col = 1; col <= S.gridCols; col++) {
      const seatNum = (row - 1) * S.gridCols + col;
      const cell    = document.createElement('div');
      cell.className    = 'seat-cell';
      cell.dataset.seat = seatNum;
      cell.innerHTML    = `<span class="seat-number">S${seatNum}</span>
                           <span class="seat-empty-label">Empty</span>`;

      // ── Drag-over / drop ────────────────────────────────
      cell.addEventListener('dragover', e => {
        e.preventDefault();
        cell.classList.add('drag-over');
      });
      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
      cell.addEventListener('drop', e => {
        e.preventDefault();
        cell.classList.remove('drag-over');
        if (S.dragMac) {
          assignSeat(S.dragMac, seatNum);
          S.dragMac = null;
          renderGrid();
        }
      });

      // ── Click ───────────────────────────────────────────
      // cell.addEventListener('click', () => {
      //   if (S.moveMac) {
      //     // Complete the move
      //     assignSeat(S.moveMac, seatNum);
      //     cancelMoveMode();
      //     renderGrid();
      //     return;
      //   }
      //   const mac = S.seats[seatNum];
      //   if (mac && S.units[mac]) openModal(mac);
      // });

      cell.addEventListener('dragstart', e => {
        if (e.target.classList.contains('move-btn')) { e.preventDefault(); return; }
        const occupantMac = S.seats[parseInt(cell.dataset.seat)];
        if (!occupantMac) return;
        
        // 🔴 Add e.dataTransfer
        e.dataTransfer.setData('text/plain', occupantMac); 
        
        S.dragMac = occupantMac;
        cell.style.opacity = '0.5';
      });
      cell.addEventListener('dragend', () => {
        cell.style.opacity = '1';
        S.dragMac = null;
      });
      

      grid.appendChild(cell);
    }
  }

  // ── Tray drag-over / drop (unassign by dropping here) ──
  E.trayUnits.addEventListener('dragover', e => {
    e.preventDefault();
    E.trayUnits.classList.add('drag-over');
  });
  E.trayUnits.addEventListener('dragleave', () =>
    E.trayUnits.classList.remove('drag-over'));
  E.trayUnits.addEventListener('drop', e => {
    e.preventDefault();
    E.trayUnits.classList.remove('drag-over');
    if (S.dragMac) {
      unassignSeat(S.dragMac);
      S.dragMac = null;
      renderGrid();
    }
  });

  // ── Tray click (complete move-mode unassign) ────────────
  // E.trayUnits.addEventListener('click', () => {
  //   if (S.moveMac) {
  //     unassignSeat(S.moveMac);
  //     cancelMoveMode();
  //     renderGrid();
  //   }
  // });

  renderGrid();
}

// ============================================================
//  Render grid and tray (called on every state change)
// ============================================================
function renderGrid() {
  // Active unit count badge
  const activeCount = Object.values(S.units)
    .filter(u => u.status === 'active').length;
  E.unitCount.textContent = activeCount;

  // ── Tray — unassigned units ──────────────────────────────
  E.trayUnits.innerHTML = '';

  // Show hint in move mode
  if (S.moveMac) {
    E.trayUnits.classList.add('move-target');
    const hint = document.createElement('span');
    hint.className   = 'tray-label';
    hint.textContent = 'Drop here to unassign';
    E.trayUnits.appendChild(hint);
  } else {
    E.trayUnits.classList.remove('move-target');
  }

  Object.values(S.units).forEach(u => {
    if (u.seatNumber) return; // placed in grid

    const chip       = document.createElement('div');
    chip.className   = 'tray-unit' + (u.status === 'inactive' ? ' inactive' : '');
    chip.textContent = u.id ? `#${u.id}` : u.mac.slice(-5);
    chip.title       = u.mac;

    if (u.status === 'active') {
      chip.draggable = true;
      // 🔴 Add 'e' and e.dataTransfer
      chip.addEventListener('dragstart', (e) => { 
        e.dataTransfer.setData('text/plain', u.mac); 
        S.dragMac = u.mac;
        chip.classList.add('dragging');
      });
      chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
    }
    E.trayUnits.appendChild(chip);
  });

  // ── Grid cells ───────────────────────────────────────────
  E.seatGrid.querySelectorAll('.seat-cell').forEach(cell => {
    const seatNum    = parseInt(cell.dataset.seat);
    const mac        = S.seats[seatNum];
    const unit       = mac ? S.units[mac] : null;
    const seatNumEl  = cell.querySelector('.seat-number');

    cell.innerHTML = '';
    cell.appendChild(seatNumEl);

    // Highlight if in move mode
    if (S.moveMac) {
      cell.classList.add('move-target');
    } else {
      cell.classList.remove('move-target');
    }

    if (!unit) {
      cell.classList.remove('occupied');
      cell.draggable = false;
      const empty = document.createElement('span');
      empty.className   = 'seat-empty-label';
      empty.textContent = 'Empty';
      cell.appendChild(empty);
      return;
    }

    cell.classList.add('occupied');

    // Make occupied cells draggable for rearranging
    cell.draggable = true;

    // Status dot
    const dot       = document.createElement('span');
    dot.className   = 'seat-status-dot ' + (unit.status || 'inactive');
    cell.appendChild(dot);

    // Unit info
    const unitDiv   = document.createElement('div');
    unitDiv.className = 'seat-unit';

    const idSpan    = document.createElement('span');
    idSpan.className   = 'seat-unit-id' + (unit.status === 'inactive' ? ' inactive' : '');
    idSpan.textContent = unit.id ? `Unit #${unit.id}` : `(${unit.mac.slice(-5)})`;
    unitDiv.appendChild(idSpan);

    if (unit.studentName) {
      const nameSpan      = document.createElement('span');
      nameSpan.className   = 'seat-student-name';
      nameSpan.textContent = unit.studentName;
      unitDiv.appendChild(nameSpan);
    }
    if (unit.studentId) {
      const idLabel       = document.createElement('span');
      idLabel.className   = 'seat-student-id';
      idLabel.textContent = unit.studentId;
      unitDiv.appendChild(idLabel);
    }

    // ↕ Move button — click-to-move alternative to drag
    const moveBtn       = document.createElement('button');
    moveBtn.className   = 'btn-ghost small move-btn';
    moveBtn.textContent = S.moveMac === mac ? '✕ Cancel' : '↕';
    moveBtn.title       = 'Move to another seat';
    moveBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (S.moveMac === mac) {
        cancelMoveMode();
        renderGrid();
      } else {
        S.moveMac = mac;
        renderGrid();
        log('sys', `Click a seat to move Unit #${unit.id || mac.slice(-5)}`);
      }
    });
    unitDiv.appendChild(moveBtn);

    cell.appendChild(unitDiv);

    // // Right-click to unassign
    // cell.addEventListener('contextmenu', e => {
    //   e.preventDefault();
    //   if (confirm(`Remove Unit #${unit.id || ''} from seat ${seatNum}?`)) {
    //     unassignSeat(mac);
    //     cancelMoveMode();
    //     renderGrid();
    //   }
    // });
  });
}


// ============================================================
//  Grid Interaction Listeners (Run once on load)
// ============================================================
E.seatGrid.addEventListener('click', e => {
  const cell = e.target.closest('.seat-cell');
  if (!cell) return;
  const seatNum = parseInt(cell.dataset.seat);

  if (S.moveMac) {
    assignSeat(S.moveMac, seatNum);
    cancelMoveMode();
    renderGrid();
    return;
  }

  const mac = S.seats[seatNum];
  if (mac && S.units[mac]) openModal(mac);
});

E.seatGrid.addEventListener('contextmenu', e => {
  e.preventDefault();
  const cell = e.target.closest('.seat-cell');
  if (!cell) return;
  
  const seatNum = parseInt(cell.dataset.seat);
  const mac = S.seats[seatNum];
  const unit = mac ? S.units[mac] : null;

  if (unit) {
    const identifier = unit.id ? unit.id : unit.mac.slice(-5);
    if (confirm(`Remove Unit #${identifier} from seat ${seatNum}?`)) {
      unassignSeat(mac);
      cancelMoveMode();
      renderGrid();
    }
  }
});

// ============================================================
//  Exam controls
// ============================================================
E.setTimerBtn.addEventListener('click', () => {
  const h  = parseInt(E.inpH.value) || 0;
  const m  = parseInt(E.inpM.value) || 0;
  const s  = parseInt(E.inpS.value) || 0;
  const ms = (h * 3600 + m * 60 + s) * 1000;
  if (ms <= 0) { log('err', 'Duration must be greater than 0'); return; }
  S.remainingMs = ms;
  E.bigTimer.classList.remove('warning', 'ended');
  renderTimer();
  send({ cmd: 'timer', duration_ms: ms });
});

E.startBtn.addEventListener('click', () => {
  if (!S.remainingMs) { log('err', 'Set a timer first'); return; }
  send({ cmd: 'start' });
  S.running = true; S.paused = false;
  E.bigTimer.classList.remove('warning', 'ended');
  startTicker();
});

E.pauseBtn.addEventListener('click', () => {
  send({ cmd: 'pause' });
  S.running = false; S.paused = true;
  stopTicker();
});

E.endBtn.addEventListener('click', () => {
  if (!confirm('End the exam for all units?')) return;
  send({ cmd: 'end' });
  S.running = false; S.remainingMs = 0;
  stopTicker(); renderTimer();
  E.bigTimer.classList.add('ended');
});

E.resetBtn.addEventListener('click', () => {
  send({ cmd: 'reset' });
  S.running = false; S.paused = false;
  S.remainingMs = 0;
  stopTicker(); renderTimer();
  E.bigTimer.classList.remove('warning', 'ended');
});

// ============================================================
//  Raw JSON
// ============================================================
E.rawBtn.addEventListener('click', () => {
  const raw = E.rawInp.value.trim();
  if (!raw) return;
  try { send(JSON.parse(raw)); E.rawInp.value = ''; }
  catch(e) { log('err', 'Invalid JSON: ' + e.message); }
});
E.rawInp.addEventListener('keydown', e => { if (e.key === 'Enter') E.rawBtn.click(); });

// ============================================================
//  Timer
// ============================================================
function startTicker() {
  stopTicker();
  lastTick = Date.now();
  ticker   = setInterval(() => {
    const now     = Date.now();
    const elapsed = now - lastTick;
    lastTick      = now;
    S.remainingMs = Math.max(0, S.remainingMs - elapsed);
    renderTimer();
    if (S.remainingMs <= 0) {
      stopTicker();
      E.bigTimer.classList.add('ended');
    } else if (S.remainingMs < 5 * 60 * 1000) {
      E.bigTimer.classList.add('warning');
    }
  }, 250);
}

function stopTicker() {
  if (ticker) { clearInterval(ticker); ticker = null; }
}

function renderTimer() {
  const ms = S.remainingMs;
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  const s  = Math.floor((ms % 60000) / 1000);
  E.bigTimer.textContent = h > 0
    ? `${pad(h)}:${pad(m)}:${pad(s)}`
    : `${pad(m)}:${pad(s)}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

// ============================================================
//  Modal
// ============================================================
function openModal(mac) {
  const unit = S.units[mac];
  if (!unit) return;
  S.activeUnit = mac;

  E.modalTitle.textContent    = unit.id ? `Unit #${unit.id}` : `Unit (${mac.slice(-5)})`;
  E.modalSubtitle.textContent = `MAC: ${mac} — Seat: ${unit.seatNumber || 'Unassigned'}`;
  E.mPunish.value = '';
  E.mDeduct.value = '';

  E.modalStudentInfo.classList.add('hidden');
  E.modalFixedInfo.classList.add('hidden');

  if (S.examMode === 'roll') {
    E.modalStudentInfo.classList.remove('hidden');
    E.modalName.value      = unit.studentName || '';
    E.modalStudentId.value = unit.studentId   || '';
    if (unit.studentPhoto) {
      E.modalPhoto.src = unit.studentPhoto;
      E.modalPhoto.classList.remove('hidden');
      E.modalPhotoPlaceholder.classList.add('hidden');
    } else {
      E.modalPhoto.classList.add('hidden');
      E.modalPhotoPlaceholder.classList.remove('hidden');
    }
  } else {
    E.modalFixedInfo.classList.remove('hidden');
    E.modalFixedName.textContent = unit.studentName || '—';
    E.modalFixedId.textContent   = unit.studentId   || '—';
    if (unit.studentPhoto) E.modalFixedPhoto.src = unit.studentPhoto;
  }

  E.modalBg.classList.remove('hidden');
}

function closeModal() {
  E.modalBg.classList.add('hidden');
  S.activeUnit = null;
}

E.modalClose.addEventListener('click', closeModal);
E.modalBg.addEventListener('click', e => { if (e.target === E.modalBg) closeModal(); });

E.modalSaveStudent?.addEventListener('click', () => {
  const mac = S.activeUnit;
  if (!mac || !S.units[mac]) return;
  const name = E.modalName.value.trim();
  const id   = E.modalStudentId.value.trim();
  S.units[mac].studentName = name;
  S.units[mac].studentId   = id;
  saveStudentInfo(mac, name, id, S.units[mac].studentPhoto);
  renderGrid();
  log('sys', `Saved student info for Unit #${S.units[mac].id}: ${name} (${id})`);
});

E.mBeepBtn.addEventListener('click', () => {
  const u = S.units[S.activeUnit];
  if (u?.id) send({ cmd: 'beep', device_id: u.id });
});

E.mWarnBtn.addEventListener('click', () => {
  const u = S.units[S.activeUnit];
  if (u?.id) send({ cmd: 'warn', device_id: u.id });
});

E.mDisableBtn.addEventListener('click', () => {
  const u = S.units[S.activeUnit];
  if (!u?.id) return;
  const obj = { cmd: 'disable', device_id: u.id };
  const p   = parseInt(E.mPunish.value) || 0;
  if (p > 0) obj.punish_ms = p * 1000;
  send(obj);
  u.status = 'disabled';
  renderGrid();
});

E.mEnableBtn.addEventListener('click', () => {
  const u = S.units[S.activeUnit];
  if (!u?.id) return;
  send({ cmd: 'enable', device_id: u.id });
  u.status = 'active';
  renderGrid();
});

E.mDeductBtn.addEventListener('click', () => {
  const u = S.units[S.activeUnit];
  if (!u?.id) return;
  const s = parseInt(E.mDeduct.value);
  if (!s || s <= 0) { log('err', 'Enter seconds to deduct'); return; }
  send({ cmd: 'deduct', device_id: u.id, time_ms: s * 1000 });
});

// ============================================================
//  Log
// ============================================================
function log(tag, msg) {
  const now  = new Date();
  const t    = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML =
    `<span class="log-t">${t}</span>` +
    `<span class="log-tag ${tag}">${tag.toUpperCase()}</span>` +
    `<span class="log-msg">${esc(msg)}</span>`;
  E.log.appendChild(line);
  E.log.scrollTop = E.log.scrollHeight;
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

E.clearLogBtn.addEventListener('click', () => { E.log.innerHTML = ''; });

// ============================================================
//  Setup status helper
// ============================================================
function setSetupStatus(dotClass, text) {
  E.setupDot.className      = 'dot' + (dotClass ? ' ' + dotClass : '');
  E.setupStatus.textContent = text;
}

// ============================================================
//  Init
// ============================================================
renderTimer();
showPage('landing');

$('btn-mock')?.addEventListener('click', () => {
  // Mock the send function
  window.send = async (obj) => {
    log('out', '[MOCK] ' + JSON.stringify(obj));
    return true;
  };

  S.connMode = 'mock';
  onConnected(); // Jumps straight to dashboard

  // Feed fake units to the app
  const fakeUnits = [
    { event: 'wemos_connected', mac: 'AA:BB:CC:DD:EE:01', id: 1, via: 'mock' },
    { event: 'wemos_connected', mac: 'AA:BB:CC:DD:EE:02', id: 2, via: 'mock' },
    { event: 'wemos_connected', mac: 'AA:BB:CC:DD:EE:03', id: 3, via: 'mock' },
    { event: 'wemos_connected', mac: 'AA:BB:CC:DD:EE:04', id: 4, via: 'mock' }
  ];

  fakeUnits.forEach((u, i) => {
    setTimeout(() => onMessage(JSON.stringify(u)), i * 300);
  });

  // Keep them alive
  setInterval(() => {
    if (S.connected) {
      onMessage(JSON.stringify({
        event: 'heartbeat',
        units: fakeUnits.map(u => ({ mac: u.mac, id: u.id }))
      }));
    }
  }, 3000);
});
````
### 7.1.5 public/penapp/style.css  
````css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Syne:wght@400;600;700&display=swap');

/* ── Theme tokens ─────────────────────────────────────────── */
:root {
  --accent:  #7c6fff;
  --green:   #22c55e;
  --amber:   #f59e0b;
  --red:     #ef4444;
  --r:       10px;
  --font:    'Syne', sans-serif;
  --mono:    'JetBrains Mono', monospace;
  --t:       0.18s ease;
}

[data-theme="dark"] {
  --bg:      #0c0c0f;
  --bg2:     #13131a;
  --bg3:     #1a1a24;
  --border:  #26263a;
  --text:    #e4e4f0;
  --muted:   #72728a;
  --dot-off: #36364a;
}
[data-theme="light"] {
  --bg:      #f2f2f7;
  --bg2:     #ffffff;
  --bg3:     #f7f7fc;
  --border:  #dcdce8;
  --text:    #111118;
  --muted:   #72728a;
  --dot-off: #c8c8d8;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  transition: background var(--t), color var(--t);
}

.page { min-height: 100vh; }
.hidden { display: none !important; }

/* ── Landing ──────────────────────────────────────────────── */
.landing-wrap {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 2rem;
  gap: 1.5rem;
  max-width: 860px;
  margin: 0 auto;
}

.landing-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand { font-size: 2rem; font-weight: 700; color: var(--accent); letter-spacing: 0.01em; }
.brand.small { font-size: 1rem; }

.landing-sub { color: var(--muted); font-size: 0.9rem; }

.mode-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 1rem;
}

.mode-card {
  background: var(--bg2);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 1.5rem 1.2rem;
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  transition: border-color var(--t), transform 0.15s;
  font-family: var(--font);
  color: var(--text);
}
.mode-card:hover { border-color: var(--accent); transform: translateY(-3px); }
.mode-icon  { font-size: 1.6rem; color: var(--accent); line-height: 1; }
.mode-title { font-size: 0.95rem; font-weight: 600; }
.mode-desc  { font-size: 0.78rem; color: var(--muted); line-height: 1.5; }

/* ── Setup ────────────────────────────────────────────────── */
.setup-wrap {
  max-width: 580px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
}

.setup-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.back-btn {
  background: none;
  border: none;
  color: var(--muted);
  font-family: var(--font);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0;
  transition: color var(--t);
}
.back-btn:hover { color: var(--accent); }

.setup-sec h1 { font-size: 1.3rem; font-weight: 700; margin-bottom: 1rem; }
.setup-section-title { font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; }

.steps {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 1rem 1.2rem 1rem 2.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin-bottom: 1rem;
}
.steps li { font-size: 0.875rem; line-height: 1.55; color: var(--text); }

.info-note {
  font-size: 0.8rem;
  color: var(--muted);
  background: var(--bg2);
  border-left: 2px solid var(--accent);
  border-radius: 0 6px 6px 0;
  padding: 0.5rem 0.75rem;
  line-height: 1.5;
  margin-bottom: 1rem;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--mono);
  font-size: 0.78rem;
  color: var(--muted);
}

/* ── Exam mode toggle ─────────────────────────────────────── */
.exam-mode-toggle {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.2rem;
}

.toggle-label { font-size: 0.85rem; font-weight: 600; }

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 46px;
  height: 24px;
}
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--border);
  border-radius: 24px;
  cursor: pointer;
  transition: background var(--t);
}
.toggle-slider::before {
  content: '';
  position: absolute;
  width: 18px; height: 18px;
  left: 3px; bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: transform var(--t);
}
.toggle-switch input:checked + .toggle-slider { background: var(--accent); }
.toggle-switch input:checked + .toggle-slider::before { transform: translateX(22px); }

/* ── Grid config ──────────────────────────────────────────── */
.grid-config { display: flex; flex-direction: column; gap: 0.5rem; }
.grid-size-inputs {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.grid-size-inputs input { width: 60px; text-align: center; }

/* ── Header ───────────────────────────────────────────────── */
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.4rem;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 20;
}
.header-left, .header-right { display: flex; align-items: center; gap: 0.5rem; }

/* ── Main ─────────────────────────────────────────────────── */
main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 1.2rem 1.4rem;
}

.card-title {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 1rem;
}

.card-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.card-titlebar .card-title { margin-bottom: 0; }

/* ── Duration row ─────────────────────────────────────────── */
.duration-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.75rem; margin-bottom: 0.75rem; }
.dur-group { display: flex; flex-direction: column; gap: 0.4rem; }
.dur-inputs { display: flex; align-items: center; gap: 0.3rem; }
.dur-inputs input { width: 56px; text-align: center; }
.dur-sep { font-size: 0.82rem; color: var(--muted); }

/* ── Big timer ────────────────────────────────────────────── */
.big-timer {
  font-family: var(--mono);
  font-size: 3.8rem;
  font-weight: 600;
  text-align: center;
  letter-spacing: 0.04em;
  color: #4fffb0;
  margin: 0.6rem 0 1rem;
  transition: color 0.3s;
}
.big-timer.warning { color: var(--amber); }
.big-timer.ended   { color: var(--red); }
.exam-btns { display: flex; flex-wrap: wrap; gap: 0.55rem; }

/* ── Unassigned tray ──────────────────────────────────────── */
.unassigned-tray {
  background: var(--bg3);
  border: 1.5px dashed var(--border);
  border-radius: var(--r);
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  min-height: 56px;
}
.tray-label {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  display: block;
  margin-bottom: 0.5rem;
}
.tray-units {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-height: 32px;
}
.tray-unit {
  background: var(--bg2);
  border: 1.5px solid var(--accent);
  border-radius: 6px;
  padding: 0.3rem 0.65rem;
  font-family: var(--mono);
  font-size: 0.78rem;
  color: var(--accent);
  cursor: grab;
  user-select: none;
  transition: opacity var(--t), transform 0.1s;
}
.tray-unit:active { cursor: grabbing; opacity: 0.7; }
.tray-unit.dragging { opacity: 0.4; }
.tray-unit.inactive {
  border-color: var(--muted);
  color: var(--muted);
  cursor: default;
}

/* ── Proctor row ──────────────────────────────────────────── */
.proctor-row {
  text-align: center;
  font-size: 0.75rem;
  color: var(--muted);
  margin-bottom: 0.75rem;
  padding: 0.4rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg3);
}
.grid-header-right { display: flex; align-items: center; gap: 0.5rem; }

/* ── Seat grid ────────────────────────────────────────────── */
.seat-grid {
  display: grid;
  gap: 0.6rem;
}

.seat-cell {
  background: var(--bg3);
  border: 1.5px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem;
  min-height: 90px;
  position: relative;
  transition: border-color var(--t), background var(--t);
  cursor: pointer;
}
.seat-cell:hover { border-color: var(--accent); }
.seat-cell.drag-over {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--bg3));
}
.seat-cell.occupied { border-color: var(--border); }
.seat-cell.occupied:hover { border-color: var(--accent); }

.seat-number {
  position: absolute;
  top: 5px;
  right: 6px;
  font-family: var(--mono);
  font-size: 0.65rem;
  color: var(--muted);
  font-weight: 600;
}

.seat-empty-label {
  font-size: 0.72rem;
  color: var(--dot-off);
  text-align: center;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.seat-unit {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  height: 100%;
}

.seat-unit-id {
  font-family: var(--mono);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--accent);
}
.seat-unit-id.inactive { color: var(--muted); }

.seat-student-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.seat-student-id {
  font-family: var(--mono);
  font-size: 0.68rem;
  color: var(--muted);
}

.seat-status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--green);
  position: absolute;
  top: 6px;
  left: 7px;
}
.seat-status-dot.inactive { background: var(--muted); }
.seat-status-dot.disabled { background: var(--red); }
.seat-status-dot.warning  { background: var(--amber); }

/* ── Raw / Log ────────────────────────────────────────────── */
.field-hint { font-size: 0.78rem; color: var(--muted); margin-bottom: 0.7rem; }
.input-row  { display: flex; gap: 0.5rem; }
.input-row input { flex: 1; }

#log {
  font-family: var(--mono);
  font-size: 0.73rem;
  max-height: 210px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.log-line { display: flex; gap: 0.6rem; padding: 0.18rem 0; border-bottom: 1px solid var(--border); }
.log-t   { color: var(--muted); min-width: 64px; flex-shrink: 0; }
.log-tag { min-width: 36px; font-weight: 600; flex-shrink: 0; }
.log-tag.out { color: var(--accent); }
.log-tag.in  { color: #4fffb0; }
.log-tag.err { color: var(--red); }
.log-tag.sys { color: var(--amber); }
.log-msg { color: var(--text); word-break: break-all; }

/* ── Modal ────────────────────────────────────────────────── */
.modal-bg {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  width: min(480px, 95vw);
  padding: 1.3rem 1.5rem;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 1rem;
}
.modal-head h3 { font-size: 1rem; font-weight: 600; }
.modal-subtitle { font-size: 0.75rem; color: var(--muted); margin-top: 0.15rem; }
.modal-body { display: flex; flex-direction: column; gap: 0.9rem; }

/* ── Student info in modal ────────────────────────────────── */
.modal-student-info {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  padding: 0.75rem;
  background: var(--bg3);
  border-radius: 8px;
  margin-bottom: 0.75rem;
  border: 1px solid var(--border);
}
.student-photo-wrap { flex-shrink: 0; }
.student-photo {
  width: 72px; height: 72px;
  border-radius: 8px;
  object-fit: cover;
  background: var(--bg);
  border: 1px solid var(--border);
  display: block;
}
.photo-placeholder {
  width: 72px; height: 72px;
  border-radius: 8px;
  background: var(--bg);
  border: 1px dashed var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  color: var(--muted);
}
.student-fields { flex: 1; display: flex; flex-direction: column; gap: 0.45rem; }
.student-field { display: flex; flex-direction: column; gap: 0.2rem; }
.fixed-name { font-size: 0.9rem; font-weight: 600; }
.fixed-id   { font-family: var(--mono); font-size: 0.75rem; color: var(--muted); }

.video-feed-placeholder {
  margin-top: 0.5rem;
  background: var(--bg);
  border: 1px dashed var(--border);
  border-radius: 6px;
  padding: 0.5rem;
  font-size: 0.72rem;
  color: var(--muted);
  text-align: center;
}

.modal-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.modal-row-label { display: flex; flex-direction: column; gap: 0.12rem; }
.modal-row-label strong { font-size: 0.85rem; }
.modal-row-label span   { font-size: 0.75rem; color: var(--muted); }
.modal-row-right { display: flex; gap: 0.4rem; align-items: center; }
.modal-row-right input { width: 120px; }

/* ── Shared controls ──────────────────────────────────────── */
input[type="text"],
input[type="number"] {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-family: var(--mono);
  font-size: 0.84rem;
  padding: 0.42rem 0.65rem;
  outline: none;
  transition: border-color var(--t);
  width: 100%;
}
input:focus { border-color: var(--accent); }

button {
  font-family: var(--font);
  font-size: 0.84rem;
  border: none;
  border-radius: 6px;
  padding: 0.48rem 1.05rem;
  cursor: pointer;
  transition: opacity var(--t), transform 0.1s;
}
button:active   { transform: scale(0.97); }
button:disabled { opacity: 0.38; cursor: not-allowed; }

.btn-primary   { background: var(--accent); color: #fff; }
.btn-secondary { background: var(--bg3); border: 1px solid var(--border); color: var(--text); }
.btn-green     { background: var(--green); color: #fff; }
.btn-amber     { background: var(--amber); color: #111; }
.btn-red       { background: var(--red);   color: #fff; }
.btn-ghost     { background: none; border: 1px solid var(--border); color: var(--muted); }
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
.wide  { width: 100%; padding-top: 0.65rem; padding-bottom: 0.65rem; }
.small { font-size: 0.75rem; padding: 0.28rem 0.65rem; }

.icon-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--muted);
  border-radius: 6px;
  width: 30px; height: 30px;
  cursor: pointer;
  font-size: 0.85rem;
  display: flex; align-items: center; justify-content: center;
  transition: border-color var(--t), color var(--t);
}
.icon-btn:hover { border-color: var(--accent); color: var(--accent); }

.chip {
  font-family: var(--mono);
  font-size: 0.68rem;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 7px;
  color: var(--muted);
}

.dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--dot-off);
  flex-shrink: 0;
  transition: background 0.3s;
}
.dot.connected  { background: var(--green); box-shadow: 0 0 5px var(--green); }
.dot.connecting { background: var(--amber); }

.theme-pill {
  background: none;
  border: 1px solid var(--border);
  color: var(--muted);
  border-radius: 20px;
  font-family: var(--font);
  font-size: 0.72rem;
  padding: 0.25rem 0.7rem;
  cursor: pointer;
  transition: border-color var(--t), color var(--t);
}
.theme-pill:hover { border-color: var(--accent); color: var(--accent); }

.field-label {
  font-size: 0.72rem;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

code {
  font-family: var(--mono);
  font-size: 0.82rem;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 5px;
}

.empty-note {
  font-size: 0.83rem;
  color: var(--muted);
  text-align: center;
  padding: 0.8rem 0;
}

/* ── Move mode ────────────────────────────────────────────── */
.seat-cell.move-target {
  border-color: var(--amber);
  cursor: pointer;
}
.unassigned-tray.move-target {
  border-color: var(--amber);
  border-style: dashed;
  cursor: pointer;
}
.move-btn {
  margin-top: auto;
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  align-self: flex-start;
}

````
### 7.1.6 public/penapp/stmng.js  
````js
// ============================================================
//  public/penapp/stmng.js  — Storage Manager
//
//  Connects the Proctopen grid app to the InkSentinel backend.
//  All DB reads/writes go through here — the rest of app.js
//  should never call fetch() directly.
//
//  Usage: import * as DB from './stmng.js'
//
//  Functions:
//    DB.searchStudents(query, page)   → paginated student list
//    DB.getStudent(studentId)         → single student detail
//    DB.getActiveSession()            → current exam session
//    DB.assignStudentToSeat(...)      → PATCH session_feeds
//    DB.removeStudentFromSeat(sfId)   → PATCH session_feeds
//    DB.getFeedByCameraId(camId)      → feed row for cam_id
//    DB.pollAlerts(sessionId)         → recent detections for grid
//    DB.logSignal(cmd, params)        → write to signals via API
//
//  The backend runs at BASE_URL (same origin by default).
//  If the penapp is served from a different port, set BASE_URL.
// ============================================================

const BASE_URL = window.location.origin; // e.g. http://192.168.43.1:3000

// ── Internal fetch wrapper ────────────────────────────────────
// Attaches cookies automatically (same-origin credential).
// Returns parsed JSON or throws on HTTP error.
async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    credentials: 'include', // send JWT cookie
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (res.status === 401) {
    // JWT expired — redirect to login
    window.location.href = '/login';
    throw new Error('Unauthenticated');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ────────────────────────────────────────────────────────────
//  STUDENTS
// ────────────────────────────────────────────────────────────

/**
 * Search students by name or student_id.
 * @param {string}  q     — search query (empty = all)
 * @param {number}  page  — 1-indexed page number
 * @param {number}  limit — rows per page (default 20)
 * @returns {{ students: [], pagination: {} }}
 */
export async function searchStudents(q = '', page = 1, limit = 20) {
  const params = new URLSearchParams({ q, page, limit });
  return apiFetch(`/api/students?${params}`);
}

/**
 * Get full detail for one student including all enrollments.
 * @param {string} studentId — institutional ID e.g. '2212345678'
 */
export async function getStudent(studentId) {
  return apiFetch(`/api/students/${encodeURIComponent(studentId)}`);
}

// ────────────────────────────────────────────────────────────
//  SESSIONS
// ────────────────────────────────────────────────────────────

/**
 * Get the currently active exam session.
 * Returns { session: {...} } or { session: null }
 */
export async function getActiveSession() {
  return apiFetch('/api/sessions/active');
}

/**
 * Get attendance list for a session.
 * Returns { attendance: [{id, feed_id, feed_label, candidate_name,
 *            student_id, connected_at, alert_count}] }
 */
export async function getAttendance(sessionId) {
  return apiFetch(`/api/sessions/${sessionId}/attendance`);
}

// ────────────────────────────────────────────────────────────
//  SEAT ASSIGNMENTS
// ────────────────────────────────────────────────────────────

/**
 * Assign a student to a seat in the active session.
 * Calls PATCH /api/sessions/:id/attendance/:sfId
 * @param {number} sessionId     — exam_sessions.id
 * @param {number} sfId          — session_feeds.id
 * @param {string} candidateName — display name
 * @param {string} studentDbId   — students.student_id
 */
export async function assignStudentToSeat(sessionId, sfId, candidateName, studentDbId) {
  // Look up the students.id (PK integer) from student_id string
  let studentPkId = null;
  if (studentDbId) {
    try {
      const data = await getStudent(studentDbId);
      studentPkId = data.student?.id || null;
    } catch (_) {}
  }

  return apiFetch(`/api/sessions/${sessionId}/attendance/${sfId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      candidate_name: candidateName || null,
      student_id:     studentPkId,
    }),
  });
}

/**
 * Remove a student from a seat (clears name + student_id link).
 */
export async function removeStudentFromSeat(sessionId, sfId) {
  return apiFetch(`/api/sessions/${sessionId}/attendance/${sfId}`, {
    method: 'PATCH',
    body: JSON.stringify({ candidate_name: null, student_id: null }),
  });
}

// ────────────────────────────────────────────────────────────
//  CAMERA / FEEDS
// ────────────────────────────────────────────────────────────

/**
 * Find a feed row by camera_id (the short code shown on camera page).
 * Returns { feed: {...} } or { feed: null }
 */
export async function getFeedByCameraId(camId) {
  if (!camId) return { feed: null };
  try {
    const feeds = await apiFetch('/api/feeds');
    const feed  = feeds.find(f => f.camera_id === camId.trim().toUpperCase()) || null;
    return { feed };
  } catch (err) {
    console.error('[stmng] getFeedByCameraId error:', err.message);
    return { feed: null };
  }
}

/**
 * Get all current feeds (for dashboard status).
 */
export async function getFeeds() {
  return apiFetch('/api/feeds');
}

// ────────────────────────────────────────────────────────────
//  ALERT POLLING
// ────────────────────────────────────────────────────────────

/**
 * Fetch recent detections for a session.
 * Call this every few seconds to colour grid card borders.
 *
 * @param {number} sessionId
 * @param {number} sinceMs — only return detections newer than Date.now()-sinceMs
 * @returns {{ alerts: [{feed_id, class_label, confidence, detected_at}] }}
 *
 * Returns a Map<feed_id, maxConfidence> for easy lookup in renderGrid().
 */
export async function pollAlerts(sessionId, sinceMs = 30000) {
  const data      = await apiFetch(`/api/incidents?sessionId=${sessionId}`);
  const cutoff    = Date.now() - sinceMs;
  const alertMap  = new Map(); // feed_id → highest recent confidence

  (data.incidents || []).forEach(inc => {
    const ts = new Date(inc.detected_at).getTime();
    if (ts < cutoff) return;
    const feedId = inc.feed_id;
    const prev   = alertMap.get(feedId) || 0;
    if (inc.confidence > prev) alertMap.set(feedId, inc.confidence);
  });

  return alertMap; // Map<feed_id, confidence 0..1>
}

// ────────────────────────────────────────────────────────────
//  SIGNALS
// ────────────────────────────────────────────────────────────

/**
 * Log a signal to the InkSentinel signals table.
 * The penapp already sends via USB/BLE/WiFi — this logs it to the DB.
 * Mirrors what signals.js does for the proctor candidate page.
 *
 * @param {string} cmd     — e.g. 'start', 'warn', 'disable'
 * @param {object} params  — e.g. { device_id: 1, punish_ms: 60000 }
 */
export async function logSignal(cmd, params = {}) {
  return apiFetch('/api/signal', {
    method: 'POST',
    body:   JSON.stringify({ cmd, ...params }),
  }).catch(err => {
    // Non-fatal — pen command already sent via hardware transport
    console.warn('[stmng] logSignal failed (non-fatal):', err.message);
    return null;
  });
}

// ────────────────────────────────────────────────────────────
//  WEBSOCKET — live camera frames
// ────────────────────────────────────────────────────────────

/**
 * Open a dashboard-role WebSocket to the InkSentinel backend.
 * Returns the WebSocket object — caller attaches onmessage handler.
 *
 * The WS streams binary JPEG frames: [4-byte feedId][jpeg bytes]
 * and JSON events: {type:'feed_connected'|'feed_disconnected'|'detection'|'signal_ack'}
 */
export function openDashboardWS() {
  const url = `${BASE_URL.replace('http','ws').replace('https','wss')}/ws?role=dashboard`;
  const ws  = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  return ws;
}
````
### 7.1.7 public/penapp/penapp-ext.js  
````js
// ============================================================
//  public/penapp/penapp-ext.js  (v2)
//
//  Extension layer for the Proctopen app.
//  v2 changes: end button now also calls PUT /api/sessions/:id/end
//  Loaded AFTER app.js in index.html via:
//    <script type="module" src="/penapp/penapp-ext.js"></script>
//
//  HOW THIS WORKS WITHOUT TOUCHING app.js:
//  ─────────────────────────────────────────────────────────
//  app.js is a plain (non-module) script. Every top-level
//  const/let/function it declares lives in the shared page
//  scope — readable by any other script on the same page.
//
//  We can therefore:
//    • Read S.activeUnit, S.units, S.seats etc.
//    • Call send(), renderGrid(), log(), closeModal() directly.
//    • Add extra event listeners to buttons (they stack —
//      app.js listener still fires, ours also fires).
//    • Observe DOM changes via MutationObserver to detect
//      when the modal opens without touching openModal().
//
//  We CANNOT:
//    • Reassign a const (send, S, E ...).
//    • Change what the existing listeners do.
//
//  This file adds:
//    1. Student search + assignment in modal (left column)
//    2. Camera ID input + live feed in modal (right column)
//    3. Alert border polling on grid cells
//    4. Dashboard WS connection for live camera frames
//    5. DB signal logging via stmng.js (piggybacks on buttons)
//    6. Sidebar collapse persistence
//    7. Session + attendance loading on connect
// ============================================================

import * as DB from '/penapp/stmng.js';

// ── Wait for DOM ready ────────────────────────────────────────
// app.js runs synchronously after DOM is parsed.
// This module runs after DOMContentLoaded regardless of position.

// ════════════════════════════════════════════════════════════
//  1. SIDEBAR COLLAPSE
// ════════════════════════════════════════════════════════════
(function initSidebar() {
  const sidebar = document.getElementById('ink-sidebar');
  const toggle  = document.getElementById('ink-toggle');
  if (!sidebar || !toggle) return;

  // Restore saved state
  if (localStorage.getItem('ink-collapsed') === '1') {
    sidebar.classList.add('collapsed');
    toggle.textContent = '▶';
  }

  window.toggleSidebar = function () {
    const collapsed = sidebar.classList.toggle('collapsed');
    toggle.textContent = collapsed ? '▶' : '◀';
    localStorage.setItem('ink-collapsed', collapsed ? '1' : '0');
  };
})();

window.doLogout = async function () {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/login';
};


// ════════════════════════════════════════════════════════════
//  2. DB STATE
//  Loaded once when the dashboard connects.
// ════════════════════════════════════════════════════════════
let activeSessionId  = null;
let activeSfIdMap    = {};    // feed_label → { sfId, feedId }
let dashWs           = null;
let modalFeedId      = null;  // feed_id shown in modal
let alertFeedMap     = new Map();  // feed_id → max confidence
let alertPollTimer   = null;

// Watch for page-dash becoming visible (fires when app.js calls showPage('dash'))
const dashObserver = new MutationObserver(async (mutations) => {
  for (const m of mutations) {
    if (m.target.id === 'page-dash' && !m.target.classList.contains('hidden')) {
      await onDashConnected();
      dashObserver.disconnect(); // Only need this once
    }
  }
});
const pageDash = document.getElementById('page-dash');
if (pageDash) dashObserver.observe(pageDash, { attributes: true, attributeFilter: ['class'] });

async function onDashConnected() {
  // Load active session + attendance
  try {
    const data = await DB.getActiveSession();
    if (data?.session) {
      activeSessionId = data.session.id;
      document.getElementById('db-chip')?.style && (document.getElementById('db-chip').style.display = '');

      const att = await DB.getAttendance(activeSessionId);
      activeSfIdMap = {};
      (att.attendance || []).forEach(row => {
        activeSfIdMap[row.feed_label] = { sfId: row.id, feedId: row.feed_id };
      });
    }
  } catch (_) {
    // Backend unreachable — OK, pen features still work via serial
  }

  // Open dashboard WS for live camera frames
  connectDashWS();

  // Start alert polling
  alertPollTimer = setInterval(pollAndRenderAlerts, 5000);
  pollAndRenderAlerts(); // immediate first poll
}


// ════════════════════════════════════════════════════════════
//  3. ALERT BORDER POLLING
//  Every 5s: fetch recent detections for the session,
//  apply amber/red border + flag badge to grid cells.
// ════════════════════════════════════════════════════════════
async function pollAndRenderAlerts() {
  if (!activeSessionId) return;
  try {
    alertFeedMap = await DB.pollAlerts(activeSessionId, 30000);
    applyAlertBorders();
  } catch (_) {}
}

function applyAlertBorders() {
  const cells    = document.querySelectorAll('.seat-cell');
  let totalAlerts = 0;

  cells.forEach(cell => {
    // feed_id is stored on the cell as data-feed-id when camera is linked
    const feedId = parseInt(cell.dataset.feedId) || 0;
    const conf   = feedId ? (alertFeedMap.get(feedId) || 0) : 0;

    // Remove old states
    cell.classList.remove('alert-moderate', 'alert-high');
    cell.querySelectorAll('.seat-flag').forEach(f => f.remove());

    if (conf >= 0.85) {
      cell.classList.add('alert-high');
      appendFlagBadge(cell, 'ALERT', 'high');
      totalAlerts++;
    } else if (conf >= 0.65) {
      cell.classList.add('alert-moderate');
      appendFlagBadge(cell, 'FLAG', 'moderate');
      totalAlerts++;
    }
  });

  // Update alert chip in header
  const chip  = document.getElementById('alert-chip');
  const count = document.getElementById('alert-count');
  if (chip && count) {
    chip.style.display    = totalAlerts > 0 ? '' : 'none';
    count.textContent     = totalAlerts;
  }
}

function appendFlagBadge(cell, text, level) {
  const badge       = document.createElement('span');
  badge.className   = `seat-flag ${level}`;
  badge.textContent = text;
  cell.appendChild(badge);
}


// ════════════════════════════════════════════════════════════
//  4. DASHBOARD WS — live camera frames
//  Only used to pipe frames into the modal video box.
// ════════════════════════════════════════════════════════════
function connectDashWS() {
  if (dashWs && dashWs.readyState < 2) return; // already open or connecting
  dashWs = DB.openDashboardWS();

  dashWs.onmessage = (event) => {
    if (!(event.data instanceof ArrayBuffer)) return;

    const view   = new DataView(event.data);
    const feedId = view.getUint32(0);

    // Only render if this is the feed linked to the currently open modal
    if (feedId !== modalFeedId) return;

    const blob = new Blob([event.data.slice(4)], { type: 'image/jpeg' });
    const url  = URL.createObjectURL(blob);
    const img  = document.getElementById('modal-live-img');
    if (!img) return;
    const old = img.src;
    img.src   = url;
    if (old.startsWith('blob:')) URL.revokeObjectURL(old);
    img.style.display = 'block';

    const placeholder = document.getElementById('modal-video-placeholder');
    const badge       = document.getElementById('modal-live-badge');
    if (placeholder) placeholder.style.display = 'none';
    if (badge)       badge.style.display = '';
  };

  dashWs.onclose = () => {
    // Reconnect in 3s if still on dashboard
    setTimeout(() => {
      if (S.connected) connectDashWS();
    }, 3000);
  };
}


// ════════════════════════════════════════════════════════════
//  5. MODAL — inject extended UI, detect open via MutationObserver
// ════════════════════════════════════════════════════════════

// State for current modal
let modalSfId        = null;
let selectedStudent  = null;
let studentSearchTimer = null;

// Watch for modal-bg losing 'hidden' class — fires when app.js calls openModal()
const modalObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.attributeName === 'class') {
      const isOpen = !m.target.classList.contains('hidden');
      if (isOpen) onModalOpen();
      else        onModalClose();
    }
  }
});
const modalBg = document.getElementById('modal-bg');
if (modalBg) modalObserver.observe(modalBg, { attributes: true });

// Called every time the modal opens
function onModalOpen() {
  // S.activeUnit is set by app.js before removing 'hidden'
  const mac  = S.activeUnit;
  const unit = mac ? S.units[mac] : null;

  // Reset extended fields
  resetExtModal();

  if (!unit) return;

  // Resolve session_feeds row for this seat
  const seatLabel = `Seat ${String(unit.seatNumber || 0).padStart(2, '0')}`;
  const sfEntry   = activeSfIdMap[seatLabel] || null;
  modalSfId = sfEntry?.sfId || null;

  // Show already-assigned student if any
  if (unit.studentName) {
    showAssignedPanel(unit.studentName, unit.studentId || '');
  }

  // Restore linked camera if stored on cell
  const seatNum = unit.seatNumber;
  if (seatNum) {
    const cell = document.querySelector(`.seat-cell[data-seat="${seatNum}"]`);
    if (cell?.dataset.feedId) {
      modalFeedId = parseInt(cell.dataset.feedId);
      updateCamStatus(`Linked to feed #${modalFeedId}`);
    }
  }
}

function onModalClose() {
  // Clear modal video when closed to release frame rendering
  const img = document.getElementById('modal-live-img');
  if (img) img.style.display = 'none';
  const placeholder = document.getElementById('modal-video-placeholder');
  if (placeholder) placeholder.style.display = 'flex';
  modalFeedId = null;
}

function resetExtModal() {
  // Student search
  const searchInput = document.getElementById('student-search');
  if (searchInput) searchInput.value = '';
  closeDropdown();

  // Panels
  const selectedPanel  = document.getElementById('selected-panel');
  const assignedPanel  = document.getElementById('assigned-student-panel');
  if (selectedPanel) selectedPanel.style.display = 'none';
  if (assignedPanel) assignedPanel.style.display = 'none';

  // Camera
  const camInput = document.getElementById('modal-cam-id');
  if (camInput) camInput.value = '';
  updateCamStatus('');

  const badge = document.getElementById('modal-live-badge');
  if (badge) badge.style.display = 'none';

  selectedStudent = null;
  modalFeedId     = null;
}


// ════════════════════════════════════════════════════════════
//  6. STUDENT SEARCH
// ════════════════════════════════════════════════════════════

// Wire up the student search input (injected by index.html)
const studentSearchInput = document.getElementById('student-search');
if (studentSearchInput) {
  studentSearchInput.addEventListener('input', (e) => {
    clearTimeout(studentSearchTimer);
    const q = e.target.value.trim();
    if (!q) { closeDropdown(); return; }
    studentSearchTimer = setTimeout(() => doStudentSearch(q), 300);
  });
}

async function doStudentSearch(q) {
  try {
    const data = await DB.searchStudents(q, 1, 8);
    renderDropdown(data.students || []);
  } catch (_) {
    closeDropdown();
  }
}

function renderDropdown(students) {
  const dd = document.getElementById('student-dropdown');
  if (!dd) return;

  if (students.length === 0) {
    dd.innerHTML = `<div class="student-option" style="color:#445566;cursor:default">
      No results for that query
    </div>`;
  } else {
    dd.innerHTML = students.map(s => `
      <div class="student-option" onclick="extSelectStudent('${s.student_id}')">
        <span class="student-option-name">${s.name}</span>
        <span class="student-option-id">${s.student_id}</span>
      </div>`).join('');
  }
  dd.classList.add('open');
}

function closeDropdown() {
  document.getElementById('student-dropdown')?.classList.remove('open');
}
document.addEventListener('click', (e) => {
  if (!e.target.closest?.('.student-search-wrap')) closeDropdown();
});

// Exposed as global so inline onclick in the dropdown can call it
window.extSelectStudent = async function(studentId) {
  closeDropdown();
  if (document.getElementById('student-search'))
    document.getElementById('student-search').value = '';

  try {
    const data      = await DB.getStudent(studentId);
    selectedStudent = data.student;
    showSelectedPanel(data.student, data.enrollments);
  } catch (err) {
    log('err', 'Student lookup failed: ' + err.message);
  }
};

function showSelectedPanel(s, enrollments) {
  const panel = document.getElementById('selected-panel');
  if (!panel) return;
  panel.style.display = 'block';

  const name = document.getElementById('sel-name');
  const id   = document.getElementById('sel-id');
  const meta = document.getElementById('sel-meta');
  if (name) name.textContent = s.name;
  if (id)   id.textContent   = s.student_id;

  const courses = (enrollments || [])
    .map(e => `${e.course_code}/${e.section_name}`)
    .join(', ');
  const metaStr = [courses, s.email, s.pen_unit_id ? `Unit #${s.pen_unit_id}` : null]
    .filter(Boolean).join(' · ');
  if (meta) meta.textContent = metaStr;
}

function showAssignedPanel(name, id) {
  const panel   = document.getElementById('assigned-student-panel');
  const nameEl  = document.getElementById('assigned-name');
  const idEl    = document.getElementById('assigned-id');
  if (!panel) return;
  panel.style.display = 'block';
  if (nameEl) nameEl.textContent = name;
  if (idEl)   idEl.textContent   = id;
}

// Assign selected student to seat
document.getElementById('assign-student-btn')
  ?.addEventListener('click', async () => {
    if (!selectedStudent || !activeSessionId || !modalSfId) {
      log('err', 'Cannot assign: no student selected, or no active session');
      return;
    }
    try {
      await DB.assignStudentToSeat(
        activeSessionId, modalSfId,
        selectedStudent.name, selectedStudent.student_id
      );
      // Update local unit state so grid re-renders with the name
      const mac = S.activeUnit;
      if (mac && S.units[mac]) {
        S.units[mac].studentName = selectedStudent.name;
        S.units[mac].studentId   = selectedStudent.student_id;
      }
      renderGrid();
      showAssignedPanel(selectedStudent.name, selectedStudent.student_id);
      document.getElementById('selected-panel').style.display = 'none';
      selectedStudent = null;
      log('sys', `Assigned ${S.units[S.activeUnit]?.studentName} to seat`);
    } catch (err) {
      log('err', 'Assign failed: ' + err.message);
    }
  });

document.getElementById('clear-student-btn')
  ?.addEventListener('click', () => {
    selectedStudent = null;
    const p = document.getElementById('selected-panel');
    if (p) p.style.display = 'none';
    if (document.getElementById('student-search'))
      document.getElementById('student-search').value = '';
  });

document.getElementById('remove-student-btn')
  ?.addEventListener('click', async () => {
    if (!activeSessionId || !modalSfId) return;
    try {
      await DB.removeStudentFromSeat(activeSessionId, modalSfId);
      const mac = S.activeUnit;
      if (mac && S.units[mac]) {
        S.units[mac].studentName = '';
        S.units[mac].studentId   = '';
      }
      renderGrid();
      const p = document.getElementById('assigned-student-panel');
      if (p) p.style.display = 'none';
      log('sys', 'Student removed from seat');
    } catch (err) {
      log('err', 'Remove failed: ' + err.message);
    }
  });


// ════════════════════════════════════════════════════════════
//  7. CAMERA LINKING IN MODAL
// ════════════════════════════════════════════════════════════

document.getElementById('modal-link-cam-btn')
  ?.addEventListener('click', async () => {
    const rawId = document.getElementById('modal-cam-id')?.value
      .trim().toUpperCase();
    if (!rawId) return;

    updateCamStatus('Looking up camera...');

    try {
      const { feed } = await DB.getFeedByCameraId(rawId);
      if (!feed) {
        updateCamStatus(`⚠ No camera found with ID "${rawId}"`);
        return;
      }

      // Link this feed to the modal WS stream
      modalFeedId = feed.id;
      updateCamStatus(`● Linked: ${feed.label} (feed #${feed.id})`);

      // Store feed_id on the seat cell so alert polling works
      const mac     = S.activeUnit;
      const seatNum = S.units[mac]?.seatNumber;
      if (seatNum) {
        const cell = document.querySelector(`.seat-cell[data-seat="${seatNum}"]`);
        if (cell) cell.dataset.feedId = feed.id;
      }
    } catch (err) {
      updateCamStatus('✗ Error: ' + err.message);
    }
  });

function updateCamStatus(text) {
  const el = document.getElementById('modal-cam-status');
  if (el) el.textContent = text;
}


// ════════════════════════════════════════════════════════════
//  8. PIGGYBACK DB LOGGING ON ACTION BUTTONS
//  We add a SECOND click listener to each button.
//  app.js listener fires first (sends via serial/BLE/WS).
//  Our listener fires second (logs to DB via stmng.js).
//  No app.js modification required.
// ════════════════════════════════════════════════════════════

function addSignalLogger(buttonId, getPayload) {
  document.getElementById(buttonId)?.addEventListener('click', () => {
    const unit = S.units[S.activeUnit];
    if (!unit?.id) return;
    const { cmd, ...params } = getPayload(unit);
    // Fire-and-forget — if backend is down, we don't block the UI
    DB.logSignal(cmd, params).catch(() => {});
  });
}

// Wire loggers after DOM is ready
addSignalLogger('m-warn-btn',    (u) => ({ cmd: 'warn',    device_id: u.id }));
addSignalLogger('m-enable-btn',  (u) => ({ cmd: 'enable',  device_id: u.id }));
addSignalLogger('m-beep-btn',    (u) => ({ cmd: 'beep',    device_id: u.id }));
addSignalLogger('m-disable-btn', (u) => {
  const p = parseInt(document.getElementById('m-punish')?.value) || 0;
  return { cmd: 'disable', device_id: u.id, ...(p > 0 ? { punish_ms: p * 1000 } : {}) };
});
addSignalLogger('m-deduct-btn',  (u) => {
  const s = parseInt(document.getElementById('m-deduct')?.value) || 0;
  return { cmd: 'deduct', device_id: u.id, time_ms: s * 1000 };
});

// Also log global exam control buttons
function addGlobalSignalLogger(buttonId, getPayload) {
  document.getElementById(buttonId)?.addEventListener('click', () => {
    const { cmd, ...params } = getPayload();
    DB.logSignal(cmd, params).catch(() => {});
  });
}
addGlobalSignalLogger('start-btn',     () => ({ cmd: 'start' }));
addGlobalSignalLogger('pause-btn',     () => ({ cmd: 'pause' }));
addGlobalSignalLogger('end-btn', () => ({ cmd: 'end' }));

// ── End button also ends the DB session ──────────────────────
// The 'end' command stops pens via serial/BLE.
// We also need to mark the DB session as ended so the dashboard
// shows it as ENDED and future sessions don't see it as active.
document.getElementById('end-btn')?.addEventListener('click', async () => {
  if (!activeSessionId) return;
  if (!S.connected) return; // only act when actually in a session
  try {
    // ensure DB is loaded
    const res = await fetch(`/api/sessions/${activeSessionId}/end`, {
      method: 'PUT', credentials: 'include'
    });
    if (res.ok) {
      activeSessionId = null;
      activeSfIdMap   = {};
      log('sys', 'DB session marked as ended');
    }
  } catch (_) {
    // Non-fatal — ESP32 command still went through
  }
});
addGlobalSignalLogger('reset-btn',     () => ({ cmd: 'reset' }));
addGlobalSignalLogger('set-timer-btn', () => {
  const h  = parseInt(document.getElementById('inp-h')?.value) || 0;
  const m  = parseInt(document.getElementById('inp-m')?.value) || 0;
  const s  = parseInt(document.getElementById('inp-s')?.value) || 0;
  return { cmd: 'timer', duration_ms: (h * 3600 + m * 60 + s) * 1000 };
});

````
### 7.1.8 public/penapp/esp32_central_v4.ino
````ino
// ============================================================
//  PROCTOPEN — Central Unit (ESP32 DevKitV1)
//  v4 — AP always running + STA credential handoff to Wemos
//
//  Fix: nextId resets to 1 when all Wemos clients disconnect
//       so reconnecting units get clean IDs starting from 1
// ============================================================

//  Test my changes by sending a signal from candidate page
// and watching Serial Monitor at 115200 — you should see:
//   [Serial] Received: {"cmd":"start"}

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <ESPmDNS.h>
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ── Pins ─────────────────────────────────────────────────────
#define OLED_SDA    21
#define OLED_SCL    22
#define MODE_BUTTON 23

// ── OLED ─────────────────────────────────────────────────────
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT  64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ── mDNS ─────────────────────────────────────────────────────
#define MDNS_HOST "proctopen"

// ── AP credentials (always on) ───────────────────────────────
const char* AP_SSID = "Proctopen";
const char* AP_PASS = "proctopen123";

// ── Operating modes ──────────────────────────────────────────
enum OpMode { MODE_BLE, MODE_AP, MODE_STA };
OpMode      currentMode = MODE_BLE;
const char* modeNames[] = { "Bluetooth", "WiFi AP", "WiFi STA" };

// ── Button ───────────────────────────────────────────────────
unsigned long lastButtonPress = 0;
bool          lastButtonState = HIGH;

// ── Flash storage ────────────────────────────────────────────
Preferences prefs;

// ── STA credentials ──────────────────────────────────────────
String sta_ssid     = "";
String sta_password = "";
bool   staConfigured = false;
bool   staConnected  = false;

// ── HTTP / WebSocket ─────────────────────────────────────────
AsyncWebServer httpServer(80);
AsyncWebSocket ws("/ws");
bool           wsStarted = false;

// ── TCP server for Wemos ─────────────────────────────────────
WiFiServer tcpServer(8080);
bool       tcpRunning = false;

// ── Wemos client registry ────────────────────────────────────
struct WemosClient {
  WiFiClient client;
  uint8_t    id;
  bool       active;
  String     buf;
  bool       onAP;
  bool       credsSent;
  unsigned long lastPing;
};

bool    pendingTCPStart = false;
#define MAX_WEMOS 20
WemosClient wemos[MAX_WEMOS];
uint8_t     nextId = 1;

// ── BLE ──────────────────────────────────────────────────────
#define BLE_SVC_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_RX_UUID  "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_TX_UUID  "6e400003-b5a3-f393-e0a9-e50e24dcca9e"

BLEServer*         bleServer    = nullptr;
BLECharacteristic* bleTxChar    = nullptr;
bool               bleConnected = false;
bool               bleRunning   = false;

// ── Exam state ───────────────────────────────────────────────
enum ExamState {
  EXAM_IDLE, EXAM_READY, EXAM_RUNNING, EXAM_PAUSED, EXAM_ENDED
};
ExamState     examState  = EXAM_IDLE;
long          remainingMs = 0;
unsigned long lastMillis  = 0;

// ── Timing ───────────────────────────────────────────────────
unsigned long lastDisplay   = 0;
unsigned long lastSync      = 0;
unsigned long lastHeartbeat = 0;

// ── Config portal ────────────────────────────────────────────
bool   configPortalActive = false;
String scannedNets        = "";

// ── mDNS flag ────────────────────────────────────────────────
bool mdnsRunning = false;

// ── STA monitoring ───────────────────────────────────────────
bool          staAttempting   = false;
unsigned long staAttemptStart = 0;
#define STA_CONNECT_TIMEOUT_MS 12000

// ============================================================
//  Forward declarations
// ============================================================
void switchMode(OpMode m);
void startBLE();
void stopBLE();
void startAP();
void startSTA();
void stopSTA();
void startTCP();
void stopTCP();
void startMDNS();
void stopMDNS();
void stopWebServer();
void setupWebSocket();
void setupConfigPortal();
void scanNetworks();
void handleWebCommand(String json);
void broadcastWemos(String msg);
void sendWemos(uint8_t id, String msg);
void sendWeb(String json);
void acceptWemos();
void readWemos();
void checkButton();
void updateDisplay();
void pushStaCreds(int i);
bool isOnAPNetwork(WiFiClient& c);
void readSerialCommands(); // added this too.
String syncPacket();


// ============================================================
//  BLE callbacks
// ============================================================
class BLEConnCB : public BLEServerCallbacks {
  void onConnect(BLEServer*) override {
    bleConnected = true;
    Serial.println("BLE: web app connected");
  }
  void onDisconnect(BLEServer*) override {
    bleConnected = false;
    BLEDevice::startAdvertising();
    Serial.println("BLE: disconnected, re-advertising");
  }
};

class BLERxCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    String v = c->getValue().c_str();
    v.trim();
    if (v.length()) handleWebCommand(v);
  }
};

// ============================================================
//  WebSocket callback
// ============================================================
void onWsEvent(AsyncWebSocket*, AsyncWebSocketClient*,
               AwsEventType type, void* arg, uint8_t* data, size_t len) {
  if (type != WS_EVT_DATA) return;
  AwsFrameInfo* info = (AwsFrameInfo*)arg;
  if (info->final && info->index == 0 && info->len == len) {
    String msg = "";
    for (size_t i = 0; i < len; i++) msg += (char)data[i];
    handleWebCommand(msg);
  }
}

// ============================================================
//  Setup
// ============================================================
void setup() {
  Serial.begin(115200);
  pinMode(MODE_BUTTON, INPUT_PULLUP);

  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED failed");
    for (;;);
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(15, 20);
  display.println("PROCTOPEN CENTRAL");
  display.setCursor(30, 38);
  display.println("Booting...");
  display.display();
  delay(1500);

  prefs.begin("proctopen", false);
  sta_ssid      = prefs.getString("ssid", "");
  sta_password  = prefs.getString("pass", "");
  staConfigured = (sta_ssid.length() > 0);
  uint8_t savedMode = prefs.getUChar("mode", 0);
  prefs.end();

  currentMode = (OpMode)savedMode;
  switchMode(currentMode);
}

// ============================================================
//  Loop
// ============================================================
void loop() {
  if (pendingTCPStart) {
    pendingTCPStart = false;
    startTCP();
  }

  unsigned long now = millis();

  checkButton();
  readSerialCommands();


  // ── STA monitoring ───────────────────────────────────────
  if (currentMode == MODE_STA && staAttempting) {
    if (WiFi.status() == WL_CONNECTED) {
      staAttempting = false;
      staConnected  = true;
      Serial.print("STA connected — IP: "); Serial.println(WiFi.localIP());
      startMDNS();
      for (int i = 0; i < MAX_WEMOS; i++) {
        if (wemos[i].active && wemos[i].onAP && !wemos[i].credsSent)
          pushStaCreds(i);
      }
    } else if (now - staAttemptStart >= STA_CONNECT_TIMEOUT_MS) {
      staAttempting = false;
      staConnected  = false;
      Serial.println("STA timed out");
    }
  }

  // ── Wemos TCP ────────────────────────────────────────────
  if (tcpRunning) {
    acceptWemos();
    readWemos();
  }

  // ── Exam countdown ───────────────────────────────────────
  if (examState == EXAM_RUNNING) {
    long elapsed = (long)(now - lastMillis);
    remainingMs -= elapsed;
    if (remainingMs <= 0) {
      remainingMs = 0;
      examState   = EXAM_ENDED;
      broadcastWemos("{\"cmd\":\"end\"}\n");
      sendWeb("{\"event\":\"timeup\"}");
    }
  }
  lastMillis = now;

  // ── Sync every 5 s ───────────────────────────────────────
  if (examState == EXAM_RUNNING && now - lastSync > 5000) {
    broadcastWemos(syncPacket());
    lastSync = now;
  }

  // ── Heartbeat every 2 s ──────────────────────────────────
  if (now - lastHeartbeat > 2000) {
    String unitList = "[";
    bool first = true;
    for (int i = 0; i < MAX_WEMOS; i++) {
      if (wemos[i].active) {
        if (!first) unitList += ",";
        unitList += "{\"id\":" + String(wemos[i].id)
                + ",\"via\":\"" + String(wemos[i].onAP ? "ap" : "sta") + "\"}";
        first = false;
      }
    }
    unitList += "]";

    sendWeb("{\"event\":\"heartbeat\","
            "\"active\":1,"
            "\"mode\":\"" + String(modeNames[currentMode]) + "\","
            "\"sta_connected\":" + String(staConnected ? "true" : "false") + ","
            "\"exam_state\":" + String((int)examState) + ","
            "\"remaining_ms\":" + String(remainingMs) + ","
            "\"units\":" + unitList + "}");
    lastHeartbeat = now;
  }

  if (wsStarted) ws.cleanupClients();

  if (now - lastDisplay > 100) {
    updateDisplay();
    lastDisplay = now;
  }
}

// ============================================================
//  Button
// ============================================================
void checkButton() {
  bool s = digitalRead(MODE_BUTTON);
  if (s == LOW && lastButtonState == HIGH
      && millis() - lastButtonPress > 300) {
    lastButtonPress = millis();
    switchMode((OpMode)((currentMode + 1) % 3));
  }
  lastButtonState = s;
}

// ============================================================
//  Mode switching
// ============================================================
void switchMode(OpMode m) {
  Serial.print("Switching to: "); Serial.println(modeNames[m]);

  stopBLE();
  stopSTA();
  stopWebServer();
  stopTCP();
  stopMDNS();

  for (int i = 0; i < MAX_WEMOS; i++) {
    if (wemos[i].active) { wemos[i].client.stop(); wemos[i].active = false; }
  }
  nextId = 1;  // reset ID counter on mode switch

  currentMode = m;
  prefs.begin("proctopen", false);
  prefs.putUChar("mode", (uint8_t)m);
  prefs.end();

  startAP();

  switch (m) {
    case MODE_BLE:
      startBLE();
      break;
    case MODE_AP:
      setupWebSocket();
      httpServer.begin();
      wsStarted = true;
      break;
    case MODE_STA:
      startSTA();
      break;
  }

  pendingTCPStart = true;
}

// ============================================================
//  mDNS
// ============================================================
void startMDNS() {
  if (mdnsRunning) MDNS.end();
  if (MDNS.begin(MDNS_HOST)) {
    MDNS.addService("http", "tcp", 80);
    mdnsRunning = true;
    Serial.println("mDNS: proctopen.local ready");
  } else {
    Serial.println("mDNS: failed");
  }
}

void stopMDNS() {
  if (mdnsRunning) { MDNS.end(); mdnsRunning = false; }
}

// ============================================================
//  BLE
// ============================================================
void startBLE() {
  BLEDevice::init("Proctopen");
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new BLEConnCB());

  BLEService* svc = bleServer->createService(BLE_SVC_UUID);

  bleTxChar = svc->createCharacteristic(
    BLE_TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  bleTxChar->addDescriptor(new BLE2902());

  BLECharacteristic* rx = svc->createCharacteristic(
    BLE_RX_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  rx->setCallbacks(new BLERxCB());

  svc->start();

  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(BLE_SVC_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();

  bleRunning   = true;
  bleConnected = false;
  Serial.println("BLE: advertising as Proctopen");
}

void stopBLE() {
  if (!bleRunning) return;
  BLEDevice::deinit(true);
  bleServer    = nullptr;
  bleTxChar    = nullptr;
  bleRunning   = false;
  bleConnected = false;
}

// ============================================================
//  WiFi AP
// ============================================================
void startAP() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.print("AP started — IP: "); Serial.println(WiFi.softAPIP());
  startMDNS();
}

// ============================================================
//  WiFi STA
// ============================================================
void startSTA() {
  if (!staConfigured) {
    configPortalActive = true;
    Serial.println("No STA creds — config portal on AP");
    scanNetworks();
    setupConfigPortal();
    httpServer.begin();
    wsStarted = false;
    return;
  }

  configPortalActive = false;
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID, AP_PASS);
  WiFi.begin(sta_ssid.c_str(), sta_password.c_str());

  staAttempting   = true;
  staAttemptStart = millis();
  staConnected    = false;

  Serial.print("STA connecting to "); Serial.println(sta_ssid);

  setupWebSocket();
  httpServer.begin();
  wsStarted = true;
}

void stopSTA() {
  staConnected       = false;
  staAttempting      = false;
  configPortalActive = false;
}

// ============================================================
//  Push STA credentials to Wemos on AP subnet
// ============================================================
void pushStaCreds(int i) {
  if (!wemos[i].active || !wemos[i].client.connected()) return;
  String pkt = "{\"cmd\":\"sta_creds\","
               "\"ssid\":\"" + sta_ssid + "\","
               "\"pass\":\"" + sta_password + "\"}\n";
  wemos[i].client.print(pkt);
  wemos[i].credsSent = true;
  Serial.print("Pushed STA creds to Wemos ID: "); Serial.println(wemos[i].id);
}

// ============================================================
//  Detect AP subnet (192.168.4.x)
// ============================================================
bool isOnAPNetwork(WiFiClient& c) {
  IPAddress remote = c.remoteIP();
  IPAddress apIP   = WiFi.softAPIP();
  return (remote[0] == apIP[0] &&
          remote[1] == apIP[1] &&
          remote[2] == apIP[2]);
}

// ============================================================
//  Config portal
// ============================================================
void scanNetworks() {
  wifi_mode_t prev = WiFi.getMode();
  if (prev == WIFI_AP) WiFi.mode(WIFI_AP_STA);
  int n = WiFi.scanNetworks();
  scannedNets = "[";
  for (int i = 0; i < n; i++) {
    if (i > 0) scannedNets += ",";
    scannedNets += "{\"ssid\":\"" + WiFi.SSID(i)
                + "\",\"rssi\":"  + WiFi.RSSI(i)
                + ",\"secure\":"
                + (WiFi.encryptionType(i) != WIFI_AUTH_OPEN ? "true" : "false")
                + "}";
  }
  scannedNets += "]";
  if (prev == WIFI_AP) WiFi.mode(WIFI_AP);
}

void setupConfigPortal() {
  httpServer.on("/", HTTP_GET, [](AsyncWebServerRequest* req) {
    String html = R"rawhtml(
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Proctopen Setup</title>
<style>
  body{font-family:sans-serif;background:#111;color:#eee;
       display:flex;flex-direction:column;align-items:center;
       padding:2rem;gap:1rem;max-width:400px;margin:auto}
  h2{color:#7c6fff;margin:0}
  .net{background:#1c1c22;border:1px solid #333;border-radius:8px;
       padding:.7rem 1rem;cursor:pointer;width:100%;
       display:flex;justify-content:space-between;align-items:center}
  .net:hover{border-color:#7c6fff}
  input{width:100%;padding:.6rem;border-radius:6px;
        border:1px solid #333;background:#1a1a1a;color:#eee;font-size:1rem}
  button{background:#7c6fff;color:#fff;border:none;padding:.7rem;
         border-radius:6px;font-size:1rem;cursor:pointer;
         width:100%;font-weight:600}
  #msg{color:#7c6fff;font-size:.85rem;min-height:1rem}
</style></head><body>
<h2>Proctopen Wi-Fi Setup</h2>
<p style="color:#555;font-size:.85rem;margin:0">Select your router network.</p>
<div id="nets"></div>
<input id="ssid" placeholder="Network SSID"/>
<input id="pass" type="password" placeholder="Password (blank if open)"/>
<button onclick="save()">Save &amp; Connect</button>
<div id="msg"></div>
<script>
const nets=)rawhtml" + scannedNets + R"rawhtml(;
nets.sort((a,b)=>b.rssi-a.rssi).forEach(n=>{
  const d=document.createElement('div');
  d.className='net';
  d.innerHTML=`<span>${n.ssid}</span>
    <span style="font-size:.8rem;color:#555">
    ${n.secure?'🔒 ':''}${n.rssi}dBm</span>`;
  d.onclick=()=>document.getElementById('ssid').value=n.ssid;
  document.getElementById('nets').appendChild(d);
});
function save(){
  const s=document.getElementById('ssid').value.trim();
  const p=document.getElementById('pass').value;
  if(!s){document.getElementById('msg').textContent='Enter a network name';return;}
  document.getElementById('msg').textContent='Saving...';
  fetch('/save?ssid='+encodeURIComponent(s)+'&pass='+encodeURIComponent(p))
    .then(r=>r.text())
    .then(t=>document.getElementById('msg').textContent=t);
}
</script></body></html>)rawhtml";
    req->send(200, "text/html", html);
  });

  httpServer.on("/save", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!req->hasParam("ssid")) {
      req->send(400, "text/plain", "Missing SSID"); return;
    }
    String s = req->getParam("ssid")->value();
    String p = req->hasParam("pass") ? req->getParam("pass")->value() : "";
    prefs.begin("proctopen", false);
    prefs.putString("ssid", s);
    prefs.putString("pass", p);
    prefs.end();
    sta_ssid = s; sta_password = p; staConfigured = true;
    req->send(200, "text/plain", "Saved! Rebooting...");
    delay(1500);
    ESP.restart();
  });

  httpServer.on("/scan", HTTP_GET, [](AsyncWebServerRequest* req) {
    scanNetworks();
    req->send(200, "application/json", scannedNets);
  });
}

// ============================================================
//  WebSocket
// ============================================================
void setupWebSocket() {
  ws.onEvent(onWsEvent);
  httpServer.addHandler(&ws);
  httpServer.on("/", HTTP_GET, [](AsyncWebServerRequest* req) {
    req->send(200, "text/plain",
      "Proctopen Central v3\nWebSocket: ws://proctopen.local/ws");
  });
}

void stopWebServer() {
  if (wsStarted) {
    ws.closeAll();
    httpServer.end();
    wsStarted = false;
  }
}

// ============================================================
//  TCP server
// ============================================================
void startTCP() {
  if (tcpRunning) return;
  tcpServer.begin();
  tcpRunning = true;
  Serial.println("TCP server on port 8080");
}

void stopTCP() {
  if (!tcpRunning) return;
  for (int i = 0; i < MAX_WEMOS; i++) {
    if (wemos[i].active) { wemos[i].client.stop(); wemos[i].active = false; }
  }
  tcpServer.end();
  tcpRunning = false;
}

void acceptWemos() {
  WiFiClient c = tcpServer.available();
  if (!c) return;

  for (int i = 0; i < MAX_WEMOS; i++) {
    if (!wemos[i].active) {
      bool onAP = isOnAPNetwork(c);
      wemos[i] = { c, nextId++, true, "", onAP, false, millis() };

      Serial.print("Wemos connected — ID: "); Serial.print(wemos[i].id);
      Serial.print(" via "); Serial.println(onAP ? "AP" : "STA");

      // Catch up to current exam state
      if (examState == EXAM_READY || examState == EXAM_RUNNING
          || examState == EXAM_PAUSED) {
        wemos[i].client.print(
          "{\"cmd\":\"timer\",\"duration_ms\":" + String(remainingMs) + "}\n");
        if      (examState == EXAM_RUNNING)
          wemos[i].client.print("{\"cmd\":\"start\"}\n");
        else if (examState == EXAM_PAUSED)
          wemos[i].client.print("{\"cmd\":\"pause\"}\n");
      }

      if (currentMode == MODE_STA && onAP && staConnected)
        pushStaCreds(i);
      if (currentMode == MODE_AP)
        wemos[i].client.print("{\"cmd\":\"clear_creds\"}\n");

      sendWeb("{\"event\":\"wemos_connected\","
              "\"id\":" + String(wemos[i].id) + ","
              "\"via\":\"" + String(onAP ? "ap" : "sta") + "\"}");
      return;
    }
  }
  c.stop();
  Serial.println("Max Wemos clients reached");
}

void readWemos() {
  for (int i = 0; i < MAX_WEMOS; i++) {
    if (!wemos[i].active) continue;

    if (!wemos[i].client.connected() ||
        (millis() - wemos[i].lastPing > 8000)) {
      Serial.print("Wemos disconnected — ID: "); Serial.println(wemos[i].id);
      sendWeb("{\"event\":\"wemos_disconnected\",\"id\":"
            + String(wemos[i].id) + "}");
      wemos[i].client.stop();
      wemos[i].active = false;

      bool anyActive = false;
      for (int j = 0; j < MAX_WEMOS; j++)
        if (wemos[j].active) { anyActive = true; break; }
      if (!anyActive) {
        nextId = 1;
        Serial.println("All Wemos disconnected — ID counter reset");
      }
      continue;
    }

    while (wemos[i].client.available()) {
      char c = wemos[i].client.read();
      if (c == '\n') {
        if (wemos[i].buf == "{\"event\":\"ping\"}") {
          wemos[i].lastPing = millis();  // ← reset ping timer
        }
        wemos[i].buf = "";
      } else {
        wemos[i].buf += c;
      }
    }
  }
}

// ============================================================
//  Command handler
// ============================================================


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
 

void handleWebCommand(String json) {
  Serial.print("Web cmd: "); Serial.println(json);

  JsonDocument doc;
  if (deserializeJson(doc, json) != DeserializationError::Ok) return;
  String cmd = doc["cmd"].as<String>();

  if (cmd == "timer") {
    remainingMs = doc["duration_ms"].as<long>();
    examState   = EXAM_READY;
    broadcastWemos("{\"cmd\":\"timer\",\"duration_ms\":"
                  + String(remainingMs) + "}\n");
  }
  else if (cmd == "start") {
    examState  = EXAM_RUNNING;
    lastMillis = lastSync = millis();
    broadcastWemos("{\"cmd\":\"start\"}\n");
    sendWeb("{\"event\":\"started\"}");
  }
  else if (cmd == "pause") {
    examState = EXAM_PAUSED;
    broadcastWemos("{\"cmd\":\"pause\"}\n");
    sendWeb("{\"event\":\"paused\"}");
  }
  else if (cmd == "end") {
    examState   = EXAM_ENDED;
    remainingMs = 0;
    broadcastWemos("{\"cmd\":\"end\"}\n");
    sendWeb("{\"event\":\"ended\"}");
  }
  else if (cmd == "reset") {
    examState   = EXAM_IDLE;
    remainingMs = 0;
    broadcastWemos("{\"cmd\":\"reset\"}\n");
    sendWeb("{\"event\":\"reset\"}");
  }
  else if (cmd == "warn") {
    sendWemos(doc["device_id"].as<uint8_t>(), "{\"cmd\":\"warn\"}\n");
  }
  else if (cmd == "enable") {
    sendWemos(doc["device_id"].as<uint8_t>(), "{\"cmd\":\"enable\"}\n");
  }
  else if (cmd == "disable") {
    uint8_t id  = doc["device_id"].as<uint8_t>();
    String  pkt = "{\"cmd\":\"disable\"";
    if (doc.containsKey("punish_ms"))
      pkt += ",\"punish_ms\":" + String(doc["punish_ms"].as<long>());
    pkt += "}\n";
    sendWemos(id, pkt);
  }
  else if (cmd == "deduct") {
    sendWemos(doc["device_id"].as<uint8_t>(),
      "{\"cmd\":\"deduct\",\"time_ms\":"
      + String(doc["time_ms"].as<long>()) + "}\n");
  }
  else if (cmd == "set_mode") {
    String m = doc["mode"].as<String>();
    if      (m == "ble") switchMode(MODE_BLE);
    else if (m == "ap")  switchMode(MODE_AP);
    else if (m == "sta") switchMode(MODE_STA);
  }
  else if (cmd == "forget_wifi") {
    prefs.begin("proctopen", false);
    prefs.remove("ssid"); prefs.remove("pass");
    prefs.end();
    sta_ssid = ""; sta_password = ""; staConfigured = false;
    broadcastWemos("{\"cmd\":\"clear_creds\"}\n");
    sendWeb("{\"event\":\"wifi_forgotten\"}");
  }
}

// ============================================================
//  Broadcast / targeted send
// ============================================================
void broadcastWemos(String msg) {
  for (int i = 0; i < MAX_WEMOS; i++)
    if (wemos[i].active && wemos[i].client.connected())
      wemos[i].client.print(msg);
}

void sendWemos(uint8_t id, String msg) {
  for (int i = 0; i < MAX_WEMOS; i++) {
    if (wemos[i].active && wemos[i].id == id
        && wemos[i].client.connected()) {
      wemos[i].client.print(msg);
      return;
    }
  }
  Serial.print("Wemos ID not found: "); Serial.println(id);
}

// ============================================================
//  Send to web app
// ============================================================
void sendWeb(String json) {
  if (bleRunning && bleConnected && bleTxChar) {
    bleTxChar->setValue(json.c_str());
    bleTxChar->notify();
  }
  if (wsStarted) ws.textAll(json);
}

// ============================================================
//  Sync packet
// ============================================================
String syncPacket() {
  return "{\"cmd\":\"sync\",\"remaining_ms\":"
       + String(remainingMs) + "}\n";
}

// ============================================================
//  Display
// ============================================================
void updateDisplay() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  display.setCursor(0, 0);
  display.print("["); display.print(modeNames[currentMode]); display.print("]");

  display.setCursor(0, 11);
  display.print("AP: "); display.print(WiFi.softAPIP());

  display.setCursor(0, 21);
  switch (currentMode) {
    case MODE_BLE:
      display.print(bleConnected ? "BLE: connected" : "BLE: waiting...");
      break;
    case MODE_AP:
      display.print("proctopen.local");
      break;
    case MODE_STA:
      if (configPortalActive)    display.print("Setup: 192.168.4.1");
      else if (staConnected)     { display.print("STA: "); display.print(WiFi.localIP()); }
      else if (staAttempting)    {
        long rem = (STA_CONNECT_TIMEOUT_MS - (long)(millis() - staAttemptStart)) / 1000;
        if (rem < 0) rem = 0;
        display.print("STA: connecting ("); display.print(rem); display.print("s)");
      } else                     display.print("STA: failed");
      break;
  }

  display.setCursor(0, 31);
  if (mdnsRunning) display.print("proctopen.local");

  int cnt = 0;
  for (int i = 0; i < MAX_WEMOS; i++) if (wemos[i].active) cnt++;
  display.setCursor(0, 41);
  display.print("Units: "); display.print(cnt);

  display.setCursor(0, 51);
  switch (examState) {
    case EXAM_IDLE:   display.print("Idle"); break;
    case EXAM_ENDED:  display.print("Exam ended"); break;
    case EXAM_READY: {
      display.print("Ready  ");
      int m = (remainingMs/1000)/60, s = (remainingMs/1000)%60;
      if (m<10) display.print("0"); display.print(m);
      display.print(":");
      if (s<10) display.print("0"); display.print(s);
      break;
    }
    case EXAM_PAUSED: {
      display.print("PAUSED  ");
      int m = (remainingMs/1000)/60, s = (remainingMs/1000)%60;
      if (m<10) display.print("0"); display.print(m);
      display.print(":");
      if (s<10) display.print("0"); display.print(s);
      break;
    }
    case EXAM_RUNNING: {
      display.fillRect(0, 41, 128, 23, SSD1306_BLACK);
      display.setTextSize(2);
      display.setCursor(14, 44);
      int m = (remainingMs/1000)/60, s = (remainingMs/1000)%60;
      if (m<10) display.print("0"); display.print(m);
      display.print(":");
      if (s<10) display.print("0"); display.print(s);
      display.setTextSize(1);
      break;
    }
  }

  display.display();
}

````  
### 7.1.9 public/penapp/wemos_examinee_v5.ino 
````ino
// ============================================================
//  PROCTOPEN — Examinee Unit (Wemos D1 Mini)
//  v5 — Smart WiFi with credential handoff + AP fallback
//
//  Fix: removed lastMillis = now from connection stage blocks
//       so the exam countdown is not affected by connection logic
// ============================================================

#include <ESP8266WiFi.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <EEPROM.h>

// ── Proctopen AP credentials (never change) ──────────────────
const char* AP_SSID = "Proctopen";
const char* AP_PASS = "proctopen123";

// ── Server discovery ─────────────────────────────────────────
const char* MDNS_HOST   = "proctopen.local";
const int   SERVER_PORT = 8080;

WiFiClient client;

// ── OLED ─────────────────────────────────────────────────────
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT  64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ── Motor / LED pins ─────────────────────────────────────────
const int enablePin  = D5;
const int motorIn1   = D6;
const int motorIn2   = D7;
const int warningLED = D8;

// ── EEPROM layout ────────────────────────────────────────────
#define EEPROM_SIZE       98
#define EEPROM_MAGIC      0xAB
#define EEPROM_ADDR_MAGIC 0
#define EEPROM_ADDR_SSID  1
#define EEPROM_ADDR_PASS  34

// ── Connection stages ────────────────────────────────────────
enum ConnStage {
  CONN_STA_WIFI,
  CONN_STA_MDNS,
  CONN_STA_TCP,
  CONN_AP_WIFI,
  CONN_AP_MDNS,
  CONN_AP_TCP,
};

// ── System states ────────────────────────────────────────────
enum SystemState {
  WAITING_CONN,
  CONNECTED_IDLE,
  READY_TO_START,
  RUNNING,
  PAUSED,
  ENDED_TIMEUP,
  ENDED_PROCTOR
};

SystemState currentState = WAITING_CONN;
ConnStage   connStage;

// ── Saved STA credentials ────────────────────────────────────
char saved_ssid[33] = "";
char saved_pass[64] = "";
bool hasStaCreds    = false;

// ── Connection state ─────────────────────────────────────────
IPAddress serverIP;
bool      serverIPResolved = false;
bool      usingStaNetwork  = false;

// ── Timeouts ─────────────────────────────────────────────────
#define STA_WIFI_TIMEOUT_MS 12000
#define MDNS_RETRY_MS        3000
#define TCP_RETRY_MS         2000

unsigned long connStageStart  = 0;
unsigned long lastMdnsAttempt = 0;
unsigned long lastTcpAttempt  = 0;
unsigned long lastPingSent = 0;

// ── Timer ─────────────────────────────────────────────────────
long          remainingTime_ms = 0;
unsigned long lastMillis       = 0;

// ── Warning ───────────────────────────────────────────────────
bool          isWarningActive = false;
unsigned long warningEndTime  = 0;
bool          ledFlashState   = false;
unsigned long lastLedFlash    = 0;

// ── Disable / Punishment ──────────────────────────────────────
bool          isDisabled     = false;
bool          hasPunishTimer = false;
unsigned long punishEndTime  = 0;

// ── Deduction tracking ────────────────────────────────────────
long totalDeductedSeconds = 0;

// ── Motor (non-blocking) ──────────────────────────────────────
bool          isPenCurrentlyEnabled = false;
bool          motorRunning          = false;
unsigned long motorStopTime         = 0;

// ── TCP read buffer ───────────────────────────────────────────
String inputBuffer = "";

// ── Display refresh ───────────────────────────────────────────
unsigned long lastDisplayUpdate = 0;

// ── Forward declarations ──────────────────────────────────────
void processCommand(String json);
void updateDisplay();
void printFormattedTime(long ms);
void setPenState(bool enable);
void loadCredentials();
void saveCredentials(String ssid, String pass);
void clearCredentials();
void startConnection();
bool resolveMDNS(IPAddress &result);

// ============================================================
void setup() {
  Serial.begin(115200);

  pinMode(enablePin,  OUTPUT);
  pinMode(motorIn1,   OUTPUT);
  pinMode(motorIn2,   OUTPUT);
  pinMode(warningLED, OUTPUT);
  digitalWrite(enablePin,  LOW);
  digitalWrite(warningLED, LOW);

  EEPROM.begin(EEPROM_SIZE);
  loadCredentials();

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("OLED failed"));
    for (;;);
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(20, 20);
  display.println("PROCTOPEN v3.0");
  display.setCursor(25, 40);
  display.println("SYSTEM BOOT...");
  display.display();
  delay(1500);

  lastMillis = millis();
  startConnection();
}

// ============================================================
//  mDNS resolution
// ============================================================
bool resolveMDNS(IPAddress &result) {
  int ret = WiFi.hostByName(MDNS_HOST, result);
  return (ret == 1 && result != IPAddress(0, 0, 0, 0));
}

// ============================================================
void loop() {
  unsigned long now = millis();

  // ── Connection state machine ─────────────────────────────
  // NOTE: lastMillis is NOT touched here — only the exam
  // countdown section at the bottom manages lastMillis.

  if (connStage == CONN_STA_WIFI) {
    if (WiFi.status() == WL_CONNECTED) {
      Serial.print("STA connected: "); Serial.println(WiFi.localIP());
      usingStaNetwork = true;
      connStage       = CONN_STA_MDNS;
      lastMdnsAttempt = 0;
    } else if (now - connStageStart >= STA_WIFI_TIMEOUT_MS) {
      Serial.println("STA timeout — falling back to AP");
      WiFi.disconnect(true);
      WiFi.mode(WIFI_OFF);
      delay(100);
      WiFi.mode(WIFI_STA);
      WiFi.begin(AP_SSID, AP_PASS);
      connStage       = CONN_AP_WIFI;
      connStageStart  = now;
      usingStaNetwork = false;
    }
  }

  else if (connStage == CONN_STA_MDNS) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("STA WiFi lost — falling back to AP");
      WiFi.mode(WIFI_STA);
      WiFi.begin(AP_SSID, AP_PASS);
      connStage      = CONN_AP_WIFI;
      connStageStart = now;
    } else if (now - lastMdnsAttempt >= MDNS_RETRY_MS) {
      lastMdnsAttempt = now;
      IPAddress resolved;
      if (resolveMDNS(resolved)) {
        serverIP         = resolved;
        serverIPResolved = true;
        connStage        = CONN_STA_TCP;
        lastTcpAttempt   = 0;
        Serial.print("mDNS resolved: "); Serial.println(serverIP);
      } else {
        Serial.println("mDNS not found, retrying...");
      }
    }
  }

  else if (connStage == CONN_STA_TCP) {
    if (!client.connected()) {
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("STA WiFi lost — falling back to AP");
        WiFi.mode(WIFI_STA);
        WiFi.begin(AP_SSID, AP_PASS);
        connStage      = CONN_AP_WIFI;
        connStageStart = now;
      } else if (now - lastTcpAttempt >= TCP_RETRY_MS) {
        lastTcpAttempt = now;
        if (client.connect(serverIP, SERVER_PORT)) {
          currentState = CONNECTED_IDLE;
          lastMillis   = millis();  // sync timer base on connect
          Serial.println("TCP connected via STA");
        } else {
          Serial.println("TCP failed — re-resolving mDNS");
          serverIPResolved = false;
          connStage        = CONN_STA_MDNS;
          lastMdnsAttempt  = 0;
        }
      }
    }
  }

  else if (connStage == CONN_AP_WIFI) {
    if (WiFi.status() == WL_CONNECTED) {
      Serial.print("AP connected: "); Serial.println(WiFi.localIP());
      usingStaNetwork = false;
      connStage       = CONN_AP_MDNS;
      lastMdnsAttempt = 0;
    }
  }

  else if (connStage == CONN_AP_MDNS) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("AP WiFi lost — reconnecting");
      WiFi.begin(AP_SSID, AP_PASS);
      connStage      = CONN_AP_WIFI;
      connStageStart = now;
    } else if (now - lastMdnsAttempt >= MDNS_RETRY_MS) {
      lastMdnsAttempt = now;
      IPAddress resolved;
      if (resolveMDNS(resolved)) {
        serverIP         = resolved;
        serverIPResolved = true;
        connStage        = CONN_AP_TCP;
        lastTcpAttempt   = 0;
        Serial.print("mDNS resolved: "); Serial.println(serverIP);
      } else {
        Serial.println("mDNS not found, retrying...");
      }
    }
  }

  else if (connStage == CONN_AP_TCP) {
    if (!client.connected()) {
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("AP WiFi lost — reconnecting");
        WiFi.begin(AP_SSID, AP_PASS);
        connStage      = CONN_AP_WIFI;
        connStageStart = now;
      } else if (now - lastTcpAttempt >= TCP_RETRY_MS) {
        lastTcpAttempt = now;
        if (client.connect(serverIP, SERVER_PORT)) {
          currentState = CONNECTED_IDLE;
          lastMillis   = millis();  // sync timer base on connect
          Serial.println("TCP connected via AP");
        } else {
          Serial.println("TCP failed — re-resolving mDNS");
          serverIPResolved = false;
          connStage        = CONN_AP_MDNS;
          lastMdnsAttempt  = 0;
        }
      }
    }
  }

  // ── TCP disconnect mid-session ───────────────────────────
  if ((connStage == CONN_STA_TCP || connStage == CONN_AP_TCP)
      && currentState != WAITING_CONN
      && !client.connected()) {
    Serial.println("TCP lost — reconnecting");
    if (currentState == RUNNING || currentState == PAUSED)
      setPenState(false);
    currentState     = WAITING_CONN;
    serverIPResolved = false;
    inputBuffer      = "";
    connStage        = usingStaNetwork ? CONN_STA_MDNS : CONN_AP_MDNS;
    lastMdnsAttempt  = 0;
  }

  // ── Read incoming TCP commands ───────────────────────────
  while (client.connected() && client.available()) {
    char c = client.read();
    if (c == '\n') {
      inputBuffer.trim();
      if (inputBuffer.length() > 0) {
        processCommand(inputBuffer);
        inputBuffer = "";
      }
    } else {
      inputBuffer += c;
    }
  }

  // ── Serial passthrough ───────────────────────────────────
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      inputBuffer.trim();
      if (inputBuffer.length() > 0) {
        processCommand(inputBuffer);
        inputBuffer = "";
      }
    } else {
      inputBuffer += c;
    }
  }

  // ── Motor auto-stop ──────────────────────────────────────
  if (motorRunning && now >= motorStopTime) {
    motorRunning = false;
    digitalWrite(enablePin, LOW);
    digitalWrite(motorIn1,  LOW);
    digitalWrite(motorIn2,  LOW);
  }

  // ── Exam countdown ───────────────────────────────────────
  // lastMillis is ONLY updated here — not in connection stages
  if (currentState == RUNNING) {
    long elapsed = (long)(now - lastMillis);
    remainingTime_ms -= elapsed;
    if (remainingTime_ms <= 0) {
      remainingTime_ms = 0;
      currentState     = ENDED_TIMEUP;
      setPenState(false);
    }
  }
  lastMillis = now;

  // ── Warning LED flash ────────────────────────────────────
  if (isWarningActive) {
    if (now >= warningEndTime) {
      isWarningActive = false;
      digitalWrite(warningLED, LOW);
    } else if (now - lastLedFlash >= 300) {
      lastLedFlash  = now;
      ledFlashState = !ledFlashState;
      digitalWrite(warningLED, ledFlashState ? HIGH : LOW);
    }
  }

  // ── Punishment timer auto-enable ─────────────────────────
  if (isDisabled && hasPunishTimer && now >= punishEndTime) {
    isDisabled     = false;
    hasPunishTimer = false;
    if (currentState == RUNNING) setPenState(true);
  }

  // ── Display at 10 FPS ────────────────────────────────────
  if (now - lastDisplayUpdate > 100) {
    updateDisplay();
    lastDisplayUpdate = now;
  }
  // ── Ping ESP32 every 3 s to signal we're alive ───────────
  if (client.connected() && now - lastPingSent > 3000) {
    client.print("{\"event\":\"ping\"}\n");
    lastPingSent = now;
  }
}

// ============================================================
//  Start connection
// ============================================================
void startConnection() {
  serverIPResolved = false;
  inputBuffer      = "";
  currentState     = WAITING_CONN;
  client.stop();
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  delay(100);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);

  loadCredentials();

  if (hasStaCreds) {
    Serial.print("Trying STA: "); Serial.println(saved_ssid);
    connStage      = CONN_STA_WIFI;
    connStageStart = millis();
    WiFi.begin(saved_ssid, saved_pass);
  } else {
    Serial.println("No STA creds — using Proctopen AP");
    connStage      = CONN_AP_WIFI;
    connStageStart = millis();
    WiFi.begin(AP_SSID, AP_PASS);
  }
}

// ============================================================
//  Command processor
// ============================================================
void processCommand(String jsonString) {
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, jsonString);
  if (error) {
    Serial.print("JSON error: "); Serial.println(error.c_str());
    return;
  }

  String cmd = doc["cmd"].as<String>();
  Serial.print("CMD: "); Serial.println(cmd);

  if (cmd == "sta_creds") {
    String newSsid = doc["ssid"].as<String>();
    String newPass = doc["pass"].as<String>();
    if (newSsid.length() > 0 && newSsid != String(saved_ssid)) {
      Serial.println("Received STA creds — switching network");
      saveCredentials(newSsid, newPass);
      delay(300);
      startConnection();
    }
    return;
  }

  if (cmd == "clear_creds") {
    clearCredentials();
    Serial.println("STA credentials cleared");
    return;
  }

  if (cmd == "timer") {
    remainingTime_ms     = doc["duration_ms"].as<long>();
    currentState         = READY_TO_START;
    totalDeductedSeconds = 0;
    isWarningActive      = false;
    isDisabled           = false;
    hasPunishTimer       = false;
  }
  else if (cmd == "start") {
    lastMillis   = millis();
    currentState = RUNNING;
    if (!isDisabled) setPenState(true);
  }
  else if (cmd == "pause") {
    currentState = PAUSED;
    setPenState(false);
  }
  else if (cmd == "end") {
    currentState     = ENDED_PROCTOR;
    remainingTime_ms = 0;
    setPenState(false);
  }
  else if (cmd == "reset") {
    currentState         = CONNECTED_IDLE;
    remainingTime_ms     = 0;
    totalDeductedSeconds = 0;
    isWarningActive      = false;
    isDisabled           = false;
    hasPunishTimer       = false;
    digitalWrite(warningLED, LOW);
    setPenState(false);
  }
  else if (cmd == "warn") {
    isWarningActive = true;
    warningEndTime  = millis() + 120000;
    lastLedFlash    = millis();
  }
  else if (cmd == "disable") {
    isDisabled = true;
    setPenState(false);
    if (doc.containsKey("punish_ms")) {
      hasPunishTimer = true;
      punishEndTime  = millis() + doc["punish_ms"].as<long>();
    } else {
      hasPunishTimer = false;
    }
  }
  else if (cmd == "enable") {
    isDisabled     = false;
    hasPunishTimer = false;
    if (currentState == RUNNING) setPenState(true);
  }
  else if (cmd == "deduct") {
    long deduct_ms        = doc["time_ms"].as<long>();
    remainingTime_ms     -= deduct_ms;
    totalDeductedSeconds += (deduct_ms / 1000);
    if (remainingTime_ms <= 0) {
      remainingTime_ms = 0;
      currentState     = ENDED_TIMEUP;
      setPenState(false);
    }
  }
  else if (cmd == "sync") {
    remainingTime_ms = doc["remaining_ms"].as<long>();
    lastMillis       = millis();
  }
}

// ============================================================
//  Display
// ============================================================
void updateDisplay() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  if (currentState == WAITING_CONN) {
    display.setTextSize(2);
    display.setCursor(0, 0);
    display.println("Proctopen");
    display.setTextSize(1);
    display.setCursor(0, 20);
    display.println("Waiting for");
    display.println("Connection...");
    display.setCursor(0, 42);
    switch (connStage) {
      case CONN_STA_WIFI: {
        display.println("Trying network:");
        display.print(saved_ssid);
        long rem = (long)(STA_WIFI_TIMEOUT_MS
                   - (millis() - connStageStart)) / 1000;
        if (rem < 0) rem = 0;
        display.print(" ("); display.print(rem); display.print("s)");
        break;
      }
      case CONN_STA_MDNS:
        display.println("WiFi OK");
        display.print("Finding server...");
        break;
      case CONN_STA_TCP:
        display.print("Server: "); display.println(serverIP);
        display.print("Connecting...");
        break;
      case CONN_AP_WIFI:
        display.println("Trying Proctopen AP");
        display.print("Connecting...");
        break;
      case CONN_AP_MDNS:
        display.println("AP OK");
        display.print("Finding server...");
        break;
      case CONN_AP_TCP:
        display.print("Server: "); display.println(serverIP);
        display.print("Connecting...");
        break;
    }
    display.display();
    return;
  }

  if (currentState == CONNECTED_IDLE) {
    display.setTextSize(2);
    display.setCursor(0, 0);
    display.println("Proctopen");
    display.setTextSize(1);
    display.setCursor(0, 20);
    display.println("Connected.");
    display.setCursor(0, 32);
    display.print(usingStaNetwork ? "STA: " : "AP:  ");
    display.println(WiFi.localIP());
    display.display();
    return;
  }

  if (currentState == READY_TO_START) {
    display.setTextSize(3);
    display.setCursor(20, 0);
    printFormattedTime(remainingTime_ms);
    display.setTextSize(1);
    display.setCursor(0, 36);
    display.println("Please wait for");
    display.println("the exam to start.");
    display.display();
    return;
  }

  if (currentState == PAUSED) {
    display.setTextSize(2);
    display.setCursor(0, 0);
    display.println("Paused");
    display.setTextSize(1);
    display.setCursor(0, 22);
    display.println("Timer:");
    display.setTextSize(2);
    display.setCursor(20, 34);
    printFormattedTime(remainingTime_ms);
    display.display();
    return;
  }

  if (currentState == ENDED_TIMEUP) {
    display.setTextSize(2);
    display.setCursor(0, 10);
    display.println("Times Up!");
    display.println("Exam Ended");
    display.display();
    return;
  }

  if (currentState == ENDED_PROCTOR) {
    display.setTextSize(2);
    display.setCursor(0, 10);
    display.println("Exam Ended");
    display.setTextSize(1);
    display.setCursor(0, 38);
    display.println("- By the Proctor");
    display.display();
    return;
  }

  if (currentState == RUNNING) {
    int yOffset = 0;
    if (isWarningActive) {
      display.fillRect(0, 0, 128, 16, SSD1306_WHITE);
      display.setTextColor(SSD1306_BLACK);
      display.setTextSize(2);
      display.setCursor(22, 1);
      display.print("WARNING");
      display.setTextColor(SSD1306_WHITE);
      yOffset = 18;
    }
    if (isDisabled) {
      display.setTextSize(2);
      display.setCursor(0, yOffset);
      display.println("DISABLED!");
      display.setTextSize(1);
      display.setCursor(0, yOffset + 20);
      if (hasPunishTimer) {
        long p_rem = max(0L, (long)(punishEndTime - millis()) / 1000);
        display.print("Penalty: ");
        display.print(p_rem);
        display.println("s");
        display.setCursor(0, yOffset + 30);
      }
      display.print("Exam: ");
      printFormattedTime(remainingTime_ms);
    } else {
      display.setTextSize(3);
      display.setCursor(20, yOffset + 2);
      printFormattedTime(remainingTime_ms);
    }
    if (totalDeductedSeconds > 0) {
      display.setTextSize(1);
      display.setCursor(0, 55);
      display.print("Time deducted by ");
      if (totalDeductedSeconds >= 60) {
        display.print(totalDeductedSeconds / 60);
        display.print("m");
      }
      display.print(totalDeductedSeconds % 60);
      display.print("s");
    }
    display.display();
    return;
  }
}

// ============================================================
//  EEPROM credential storage
// ============================================================
void loadCredentials() {
  if (EEPROM.read(EEPROM_ADDR_MAGIC) == EEPROM_MAGIC) {
    for (int i = 0; i < 32; i++)
      saved_ssid[i] = EEPROM.read(EEPROM_ADDR_SSID + i);
    saved_ssid[32] = '\0';
    for (int i = 0; i < 63; i++)
      saved_pass[i] = EEPROM.read(EEPROM_ADDR_PASS + i);
    saved_pass[63] = '\0';
    hasStaCreds = (strlen(saved_ssid) > 0);
    if (hasStaCreds) {
      Serial.print("Loaded STA creds: "); Serial.println(saved_ssid);
    }
  } else {
    hasStaCreds = false;
    Serial.println("No saved STA creds");
  }
}

void saveCredentials(String ssid, String pass) {
  EEPROM.write(EEPROM_ADDR_MAGIC, EEPROM_MAGIC);
  for (int i = 0; i < 32; i++)
    EEPROM.write(EEPROM_ADDR_SSID + i,
      i < (int)ssid.length() ? ssid[i] : 0);
  for (int i = 0; i < 63; i++)
    EEPROM.write(EEPROM_ADDR_PASS + i,
      i < (int)pass.length() ? pass[i] : 0);
  EEPROM.commit();
  ssid.toCharArray(saved_ssid, 33);
  pass.toCharArray(saved_pass, 64);
  hasStaCreds = true;
  Serial.print("Saved STA creds: "); Serial.println(saved_ssid);
}

void clearCredentials() {
  EEPROM.write(EEPROM_ADDR_MAGIC, 0x00);
  EEPROM.commit();
  memset(saved_ssid, 0, sizeof(saved_ssid));
  memset(saved_pass, 0, sizeof(saved_pass));
  hasStaCreds = false;
  Serial.println("Credentials cleared");
}

// ============================================================
//  Helpers
// ============================================================
void printFormattedTime(long ms) {
  if (ms < 0) ms = 0;
  int m = (ms / 1000) / 60;
  int s = (ms / 1000) % 60;
  if (m < 10) display.print("0");
  display.print(m);
  display.print(":");
  if (s < 10) display.print("0");
  display.print(s);
}

void setPenState(bool enable) {
  if (isPenCurrentlyEnabled == enable) return;
  isPenCurrentlyEnabled = enable;

  digitalWrite(enablePin, LOW);
  digitalWrite(motorIn1,  LOW);
  digitalWrite(motorIn2,  LOW);
  delay(50);

  if (enable) {
    digitalWrite(motorIn1, HIGH);
    digitalWrite(motorIn2, LOW);
  } else {
    digitalWrite(motorIn1, LOW);
    digitalWrite(motorIn2, HIGH);
  }

  digitalWrite(enablePin, HIGH);
  motorRunning  = true;
  motorStopTime = millis() + 1000;
}

````


### 7.1.9 public/allsessions.html  
````html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proctor — All Sessions</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    .modal-overlay {
      display:none;position:fixed;inset:0;
      background:rgba(0,0,0,0.6);
      z-index:200;align-items:center;justify-content:center;
    }
    .modal-overlay.open { display:flex; }
    .modal-box {
      background:var(--surface);border:1px solid var(--border);
      border-radius:14px;padding:28px 32px;width:min(480px,95vw);
      display:flex;flex-direction:column;gap:16px;
    }
    .modal-title {
      font-family:var(--fd);font-size:20px;font-weight:700;
      letter-spacing:0.08em;text-transform:uppercase;
    }
    .form-field { display:flex;flex-direction:column;gap:6px; }

    .session-active-dot {
      width:7px;height:7px;border-radius:50%;
      background:var(--green);box-shadow:0 0 5px var(--green);
      display:inline-block;margin-right:6px;flex-shrink:0;
    }

    /* Search bar */
    .search-bar {
      display:flex;gap:10px;align-items:center;
      margin-bottom:16px;
    }
    .search-bar input {
      flex:1;
    }
    tr.hidden-row { display:none; }
  </style>
</head>
<body>
<div class="layout">
  <div id="sidebar" style="min-width:200px;width:200px;flex-shrink:0"></div>

  <main class="main">
    <div class="page-header">
      <div>
        <div class="page-title">All Sessions</div>
        <div class="page-sub" id="session-count">Loading...</div>
      </div>
      <button class="btn btn-primary" onclick="openModal()">+ New Session</button>
    </div>

    <!-- Search bar -->
    <div class="search-bar">
      <input class="input" id="search-input"
        placeholder="Search by session name, course, or instructor..."
        oninput="filterTable()">
      <button class="btn btn-ghost" onclick="clearSearch()">✕ Clear</button>
    </div>

    <!-- Session table -->
    <div class="card" style="padding:0;overflow:hidden">
      <table class="table" id="sessions-table-el">
        <thead>
          <tr>
            <th>Session</th>
            <th>Course</th>
            <th>Instructor</th>
            <th>Time Block</th>
            <th>Started</th>
            <th>Status</th>
            <th>Alerts</th>
          </tr>
        </thead>
        <tbody id="sessions-table">
          <tr><td colspan="7" style="color:var(--t3);text-align:center">Loading...</td></tr>
        </tbody>
      </table>
    </div>

  </main>
</div>

<!-- New Session Modal -->
<div class="modal-overlay" id="modal">
  <div class="modal-box">
    <div class="modal-title">New Exam Session</div>

    <div class="form-field">
      <label>Session Name <span style="color:var(--red)">*</span></label>
      <input class="input" id="inp-name"
        placeholder="e.g. CSE299_Midterm_April2026" maxlength="80">
      <span style="font-size:10px;color:var(--t3)">
        Used as the recordings folder name. Special characters become underscores.
      </span>
    </div>

    <!-- Course dropdown — populated from courses table -->
    <div class="form-field">
      <label>Course</label>
      <select class="input" id="inp-course-select" style="padding:8px 10px;font-size:13px">
        <option value="">Select course...</option>
      </select>
    </div>

    <div class="form-field">
      <label>Section</label>
      <select class="input" id="inp-section-select" style="padding:8px 10px;font-size:13px"
        disabled>
        <option value="">Select course first</option>
      </select>
    </div>

    <!-- Manual override if not in DB -->
    <div class="form-field">
      <label>Course Name <span style="font-size:10px;color:var(--t3);font-weight:400">
        (override — auto-filled from selection above)</span></label>
      <input class="input" id="inp-course" placeholder="e.g. Junior Design Project">
    </div>

    <div class="form-field">
      <label>Instructor</label>
      <input class="input" id="inp-instructor" placeholder="e.g. Dr. Rahman">
    </div>

    <div class="form-field">
      <label>Time Block</label>
      <input class="input" id="inp-time" placeholder="e.g. 09:00 – 11:00">
    </div>

    <div class="form-field">
      <label>Exam Type</label>
      <select class="input" id="inp-exam-type" style="padding:8px 10px;font-size:13px">
        <option value="midterm">Midterm</option>
        <option value="quiz">Quiz</option>
        <option value="final">Final</option>
        <option value="mock">Mock</option>
      </select>
    </div>

    <div id="modal-error"
      style="display:none;color:var(--red);font-size:12px;padding:8px 12px;
             background:var(--rdim);border-radius:4px">
    </div>

    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="createSession()">▶ Start Session</button>
    </div>
  </div>
</div>

<script src="/js/nav.js"></script>
<script>
  document.getElementById('sidebar').innerHTML = buildSidebar();
  initSidebar();

  let allSessions = [];

  async function loadSessions() {
    const data = await api('/api/sessions');
    if (!data) return;

    allSessions = data.sessions;
    document.getElementById('session-count').textContent =
      `${allSessions.length} session${allSessions.length !== 1 ? 's' : ''} total`;

    renderTable(allSessions);
  }

  function renderTable(sessions) {
    const tbody = document.getElementById('sessions-table');

    if (sessions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="color:var(--t3);text-align:center;padding:32px">
            No sessions yet — click "+ New Session" to start
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = sessions.map(s => {
      const isActive = !s.ended_at;
      const started  = new Date(s.created_at).toLocaleString();
      const alerts   = Number(s.detection_count);

      // KEY FIX: pass session id in URL so session.html reads it
      return `
        <tr style="cursor:pointer"
          onclick="window.location='/session?id=${s.id}'"
          data-name="${(s.name || '').toLowerCase()}"
          data-course="${(s.course_name || '').toLowerCase()}"
          data-instructor="${(s.instructor_name || '').toLowerCase()}">
          <td style="font-weight:500;font-family:var(--fd);font-size:14px;letter-spacing:0.04em">
            ${isActive ? '<span class="session-active-dot"></span>' : ''}
            ${s.name}
          </td>
          <td style="color:var(--t2)">${s.course_name || '—'}</td>
          <td style="color:var(--t2)">${s.instructor_name || '—'}</td>
          <td style="color:var(--t2)">${s.time_block || '—'}</td>
          <td style="color:var(--t3);font-size:11px">${started}</td>
          <td>
            <span class="badge ${isActive ? 'badge-live' : 'badge-off'}">
              ${isActive ? '● ACTIVE' : 'ENDED'}
            </span>
          </td>
          <td style="color:${alerts>0?'var(--amber)':'var(--t3)'}">
            ${alerts}
          </td>
        </tr>`;
    }).join('');
  }

  // ── Search / filter ───────────────────────────────────────

  function filterTable() {
    const q     = document.getElementById('search-input').value.toLowerCase().trim();
    const rows  = document.querySelectorAll('#sessions-table tr');

    rows.forEach(row => {
      if (!q) { row.classList.remove('hidden-row'); return; }
      const name       = row.dataset.name       || '';
      const course     = row.dataset.course     || '';
      const instructor = row.dataset.instructor || '';
      const match      = name.includes(q) || course.includes(q) || instructor.includes(q);
      row.classList.toggle('hidden-row', !match);
    });

    // Update count
    const visible = document.querySelectorAll('#sessions-table tr:not(.hidden-row)').length;
    document.getElementById('session-count').textContent =
      q ? `${visible} of ${allSessions.length} sessions` : `${allSessions.length} sessions total`;
  }

  function clearSearch() {
    document.getElementById('search-input').value = '';
    filterTable();
  }

  // ── Modal ─────────────────────────────────────────────────

  function openModal() {
    document.getElementById('modal').classList.add('open');
    document.getElementById('inp-name').focus();
    document.getElementById('modal-error').style.display = 'none';
    loadCourseDropdown();
  }

  function closeModal() {
    document.getElementById('modal').classList.remove('open');
    ['inp-name','inp-course','inp-instructor','inp-time']
      .forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('inp-exam-type').value = 'midterm';
    document.getElementById('inp-course-select').value = '';
    document.getElementById('inp-section-select').innerHTML = '<option value="">Select course first</option>';
    document.getElementById('inp-section-select').disabled = true;
  }

  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal();
  });

  // Load courses for dropdown on modal open
  async function loadCourseDropdown() {
    try {
      const res  = await fetch('/api/students?limit=1', { credentials: 'include' });
      const data = await res.json();
      // Fetch distinct courses from students API — reuse the enrolled data
      const coursesRes = await fetch('/api/students?limit=50&q=', { credentials: 'include' });
      const cData = await coursesRes.json();
      const seen  = new Map();
      (cData.students || []).forEach(s => {
        if (s.course_code && !seen.has(s.course_code))
          seen.set(s.course_code, s.course_name || s.course_code);
      });
      const sel = document.getElementById('inp-course-select');
      sel.innerHTML = '<option value="">Select course...</option>';
      [...seen.entries()].sort().forEach(([code, name]) => {
        const opt = document.createElement('option');
        opt.value   = code;
        opt.dataset.name = name;
        opt.text    = `${code} — ${name}`;
        sel.appendChild(opt);
      });
    } catch (_) {}
  }

  document.getElementById('inp-course-select').addEventListener('change', async function() {
    const code = this.value;
    const selName = this.options[this.selectedIndex]?.dataset.name || '';
    if (selName) document.getElementById('inp-course').value = selName;

    const secSel = document.getElementById('inp-section-select');
    if (!code) {
      secSel.innerHTML = '<option value="">Select course first</option>';
      secSel.disabled = true;
      return;
    }
    // Fetch sections for this course from students table
    secSel.innerHTML = '<option value="">Loading...</option>';
    secSel.disabled  = false;
    try {
      const res  = await fetch(`/api/students?limit=50&q=&section_filter=${encodeURIComponent(code)}`, { credentials: 'include' });
      const data = await res.json();
      const seen = new Map();
      (data.students || []).forEach(s => {
        if (s.course_code === code && s.section_name) {
          const key = `${s.section_name}`;
          if (!seen.has(key)) seen.set(key, { name: key, initials: s.instructor_initials || '' });
        }
      });
      secSel.innerHTML = '<option value="">Select section...</option>';
      [...seen.values()].sort((a,b) => a.name.localeCompare(b.name)).forEach(sec => {
        const opt = document.createElement('option');
        opt.value = sec.name;
        opt.text  = `Section ${sec.name}${sec.initials ? ' — ' + sec.initials : ''}`;
        opt.dataset.initials = sec.initials;
        secSel.appendChild(opt);
      });
    } catch (_) {
      secSel.innerHTML = '<option value="">Could not load sections</option>';
    }
  });

  document.getElementById('inp-section-select').addEventListener('change', function() {
    const initials = this.options[this.selectedIndex]?.dataset.initials || '';
    if (initials) document.getElementById('inp-instructor').value = initials;
  });

  async function createSession() {
    const name       = document.getElementById('inp-name').value.trim();
    const course     = document.getElementById('inp-course').value.trim();
    const instructor = document.getElementById('inp-instructor').value.trim();
    const time       = document.getElementById('inp-time').value.trim();
    const examType   = document.getElementById('inp-exam-type').value;
    const sectionName = document.getElementById('inp-section-select').value;
    const courseCode  = document.getElementById('inp-course-select').value;

    const errEl = document.getElementById('modal-error');
    if (!name) {
      errEl.textContent   = 'Session name is required';
      errEl.style.display = 'block';
      return;
    }

    const res  = await fetch('/api/sessions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name,
        course_name:     course     || null,
        instructor_name: instructor || null,
        time_block:      time       || null,
        exam_type:       examType   || 'midterm',
      })
    });

    const data = await res.json();
    if (!res.ok) {
      errEl.textContent   = data.error || 'Failed to create session';
      errEl.style.display = 'block';
      return;
    }

    closeModal();
    // Redirect to the new session's stats page
    window.location.href = `/session?id=${data.session.id}`;
  }

  document.querySelectorAll('.modal-box .input').forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') createSession(); });
  });

  loadSessions();
</script>
</body>
</html>
```` 
### 7.1.10 public/camera.html  
````html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proctor — Camera</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    /* ── Camera ID display — shown after WS connects ────── */
    #cam-id-card {
      display: none;
      padding: 20px 24px;
      background: var(--adim);
      border: 1.5px solid var(--accent);
      border-radius: 12px;
      margin-bottom: 16px;
    }
    .cam-id-label {
      font-size: 11px;
      color: var(--t3);
      letter-spacing: 0.10em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .cam-id-value {
      font-family: var(--fm);
      font-size: 2.4rem;
      font-weight: 700;
      letter-spacing: 0.18em;
      color: var(--accent);
      line-height: 1;
      margin-bottom: 12px;
    }
    .cam-id-hint {
      font-size: 11px;
      color: var(--t3);
      line-height: 1.5;
    }
    #copy-btn {
      margin-top: 10px;
      padding: 6px 16px;
      font-size: 11px;
    }
    #copy-btn.copied {
      color: var(--green);
      border-color: var(--green);
    }

    /* ── Video preview ──────────────────────────────────── */
    #video-wrap {
      width: 100%;
      aspect-ratio: 4/3;
      background: #0d1117;
      border-radius: 10px;
      overflow: hidden;
      position: relative;
      margin-bottom: 16px;
    }
    #video-preview {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: none;
    }
    #video-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: var(--t3);
      font-size: 12px;
    }
    .cam-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--t3);
      display: inline-block;
      margin-right: 6px;
    }
    .cam-status-dot.live {
      background: var(--green);
      box-shadow: 0 0 6px var(--green);
    }
  </style>
</head>
<body>
<div class="layout">
  <div id="sidebar" style="min-width:200px;width:200px;flex-shrink:0"></div>

  <main class="main" style="max-width:520px">
    <div class="page-header">
      <div>
        <div class="page-title">Camera</div>
        <div class="page-sub" id="cam-sub">Set up your webcam feed</div>
      </div>
    </div>

    <!-- ── Step 1: Config ─────────────────────────────── -->
    <div class="card" id="config-card">
      <div class="card-title">Setup</div>

      <div class="filter-group" style="margin-bottom:12px">
        <label style="font-size:11px;color:var(--t3);display:block;margin-bottom:6px">
          Camera device
        </label>
        <select class="input" id="device-select" style="padding:8px 10px;font-size:13px">
          <option value="">Loading cameras...</option>
        </select>
      </div>

      <div class="filter-group" style="margin-bottom:16px">
        <label style="font-size:11px;color:var(--t3);display:block;margin-bottom:6px">
          Seat label (e.g. Seat 01)
        </label>
        <input class="input" id="seat-label" type="text"
          placeholder="Seat 01" maxlength="30"
          style="font-size:13px">
      </div>

      <button class="btn btn-primary" id="start-btn"
        style="width:100%;padding:10px">
        ▶ Start Camera
      </button>
    </div>

    <!-- ── Cam ID card (shown after connect) ──────────── -->
    <div id="cam-id-card">
      <div class="cam-id-label">Camera ID — share with proctor</div>
      <div class="cam-id-value" id="cam-id-display">—</div>
      <div class="cam-id-hint">
        The proctor types this ID into the seat card in the Proctopen dashboard
        to link this camera to a specific seat.
      </div>
      <button class="btn btn-ghost" id="copy-btn">⧉ Copy ID</button>
    </div>

    <!-- ── Video preview ─────────────────────────────── -->
    <div id="video-wrap">
      <video id="video-preview" autoplay muted playsinline></video>
      <div id="video-placeholder">
        <div style="font-size:32px;opacity:0.3">◈</div>
        <span>Camera not started</span>
      </div>
    </div>

    <!-- ── Status + controls ──────────────────────────── -->
    <div class="card" id="status-card" style="display:none">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <span class="cam-status-dot live" id="status-dot"></span>
          <span style="font-size:13px;font-weight:600" id="status-text">LIVE</span>
          <span style="font-size:11px;color:var(--t3);margin-left:8px"
            id="fps-display"></span>
        </div>
        <button class="btn btn-danger" id="stop-btn"
          style="font-size:11px;padding:5px 14px">
          ⏹ Stop
        </button>
      </div>
    </div>

  </main>
</div>

<script src="/js/nav.js"></script>
<script>
  document.getElementById('sidebar').innerHTML = buildSidebar();
  initSidebar();

  // ── State ─────────────────────────────────────────────
  let stream    = null;  // MediaStream
  let ws        = null;  // WebSocket to backend
  let canvas    = null;  // offscreen canvas for frame capture
  let sendTimer = null;  // setInterval for frame send loop
  let camId     = null;  // assigned camera_id from backend
  const FPS     = 10;

  // ── Populate camera device list ───────────────────────
  async function populateDevices() {
    await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => {});
    const devices = await navigator.mediaDevices.enumerateDevices();
    const sel     = document.getElementById('device-select');
    sel.innerHTML = '';
    const cams    = devices.filter(d => d.kind === 'videoinput');
    if (cams.length === 0) {
      sel.innerHTML = '<option>No cameras found</option>';
      return;
    }
    cams.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.text  = d.label || `Camera ${i + 1}`;
      sel.appendChild(opt);
    });
  }

  populateDevices();

  // ── Start camera ──────────────────────────────────────
  document.getElementById('start-btn').addEventListener('click', async () => {
    const label    = document.getElementById('seat-label').value.trim();
    const deviceId = document.getElementById('device-select').value;

    if (!label) {
      alert('Enter a seat label first');
      return;
    }

    // Start webcam
    stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: deviceId ? { exact: deviceId } : undefined,
               width: 640, height: 480 }
    });

    const video = document.getElementById('video-preview');
    video.srcObject = stream;
    video.style.display = 'block';
    document.getElementById('video-placeholder').style.display = 'none';

    // Setup offscreen canvas for JPEG encoding
    canvas = document.createElement('canvas');
    canvas.width  = 640;
    canvas.height = 480;

    // Connect WebSocket
    const wsUrl = `${window.location.origin
      .replace('http','ws').replace('https','wss')}/ws?role=feed&label=${encodeURIComponent(label)}`;
    ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      document.getElementById('cam-sub').textContent = `Connected — ${label}`;
      document.getElementById('status-card').style.display = 'block';
      document.getElementById('config-card').style.display = 'none';

      // Start streaming frames
      sendTimer = setInterval(sendFrame, 1000 / FPS);

      // Request cam_id from backend after a short delay
      // (feed row is created on WS connect, camera_id assigned there)
      setTimeout(fetchCamId, 800);
    };

    ws.onmessage = (e) => {
      // Listen for cam_id assignment from server
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'cam_id_assigned' && msg.camera_id) {
          showCamId(msg.camera_id);
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      document.getElementById('cam-sub').textContent = 'Disconnected';
      const dot = document.getElementById('status-dot');
      dot.classList.remove('live');
      document.getElementById('status-text').textContent = 'OFFLINE';
      if (sendTimer) { clearInterval(sendTimer); sendTimer = null; }
    };

    ws.onerror = () => {
      alert('WebSocket connection failed. Is the Node.js server running?');
    };
  });

  // ── Send one JPEG frame ───────────────────────────────
  function sendFrame() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const video = document.getElementById('video-preview');
    if (video.readyState < 2) return; // not ready

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      if (!blob || ws.readyState !== WebSocket.OPEN) return;
      blob.arrayBuffer().then(buf => {
        try { ws.send(buf); } catch (_) {}
      });
    }, 'image/jpeg', 0.75);
  }

  // ── Fetch cam_id from the backend feed entry ──────────
  // The backend assigns a camera_id when the feed row is created.
  // We poll /api/feeds and match by client_id label.
  async function fetchCamId() {
    const label = document.getElementById('seat-label').value.trim();
    try {
      const res   = await fetch('/api/feeds', { credentials: 'include' });
      const feeds = await res.json();
      const feed  = feeds.find(f => f.label === label && f.camera_id);
      if (feed) {
        showCamId(feed.camera_id);
      } else {
        // Retry once more after 1.5s in case DB write is slow
        setTimeout(fetchCamId, 1500);
      }
    } catch (_) {}
  }

  function showCamId(id) {
    camId = id;
    document.getElementById('cam-id-card').style.display  = 'block';
    document.getElementById('cam-id-display').textContent = id;
  }

  // ── Copy cam_id to clipboard ──────────────────────────
  document.getElementById('copy-btn').addEventListener('click', () => {
    if (!camId) return;
    navigator.clipboard.writeText(camId).then(() => {
      const btn = document.getElementById('copy-btn');
      btn.textContent = '✓ Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '⧉ Copy ID';
        btn.classList.remove('copied');
      }, 2000);
    });
  });

  // ── Stop camera ───────────────────────────────────────
  document.getElementById('stop-btn').addEventListener('click', () => {
    if (sendTimer) { clearInterval(sendTimer); sendTimer = null; }
    if (ws) { ws.close(); ws = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }

    document.getElementById('video-preview').style.display = 'none';
    document.getElementById('video-preview').srcObject = null;
    document.getElementById('video-placeholder').style.display = 'flex';
    document.getElementById('cam-id-card').style.display  = 'none';
    document.getElementById('status-card').style.display  = 'none';
    document.getElementById('config-card').style.display  = 'block';
    document.getElementById('cam-sub').textContent = 'Set up your webcam feed';
  });
</script>
</body>
</html>
```` 
### 7.1.11 public/candidate.html  
````html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proctor — Candidate</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    /* ── Real-time exam timer ────────────────────────────────── */
    /* Shown only when a timer command was confirmed delivered    */
    #exam-timer-card {
      display: none; /* shown by JS when timer is confirmed */
    }
    .exam-timer-display {
      font-family: var(--fm);
      font-size: 3rem;
      font-weight: 700;
      text-align: center;
      letter-spacing: 0.06em;
      color: var(--green);
      padding: 12px 0 8px;
      transition: color 0.3s;
    }
    .exam-timer-display.warn  { color: var(--amber); }  /* < 5 min */
    .exam-timer-display.ended { color: var(--red);   }  /* 0:00    */

    .timer-state-row {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    /* ── Signal log delivery badges ─────────────────────────── */
    .sig-badge {
      font-size: 9px;
      padding: 1px 6px;
      border-radius: 3px;
      font-family: var(--fm);
      letter-spacing: 0.06em;
      font-weight: 600;
      flex-shrink: 0;
    }
    .sig-badge.delivered { background: rgba(34,197,94,0.15);  color: var(--green); }
    .sig-badge.logged    { background: rgba(245,158,11,0.15); color: var(--amber); }
    .sig-badge.error     { background: var(--rdim);           color: var(--red);   }
  </style>
</head>
<body>
<div class="layout">
  <div id="sidebar" style="min-width:200px;width:200px;flex-shrink:0"></div>

  <main class="main">
    <div class="breadcrumb">
      <a href="/dashboard">← Dashboard</a>
      <span>/</span>
      <span id="crumb-label">Loading...</span>
    </div>

    <div class="profile-grid">

      <!-- ── Left column: video + logs ─────────────────────── -->
      <div>
        <div class="video-large" id="video-wrap">
          <div class="feed-placeholder">
            <div class="feed-icon">◈</div>
            <div class="feed-status-text" id="video-status">LOADING...</div>
          </div>
          <div class="video-top-bar">
            <div class="feed-badge live" id="live-badge">
              <span class="feed-dot"></span> LIVE
            </div>
            <div id="video-label" style="
              background:rgba(7,8,13,0.7);backdrop-filter:blur(4px);
              padding:4px 10px;border-radius:4px;
              font-family:var(--fd);font-weight:700;
              font-size:14px;letter-spacing:0.08em">—
            </div>
          </div>
          <div class="alert-banner" id="alert-banner" style="display:none">
            ⚠ SUSPICIOUS ACTIVITY DETECTED
          </div>
        </div>

        <!-- Detection log -->
        <div class="card" style="margin-bottom:16px">
          <div class="card-title">Detection Log</div>
          <div id="detection-log" style="max-height:220px;overflow-y:auto">
            <div style="color:var(--t3);font-size:12px">Loading...</div>
          </div>
        </div>

        <!-- Per-unit delivery status — populated by signal_ack WS messages.
             Hidden until first signal is sent.
             ESP32 column: updated on serial write confirmation.
             Wemos column: updated when ESP32 firmware echoes back JSON ack. -->
        <div class="card" id="unit-status-card" style="display:none;margin-bottom:16px">
          <div class="card-title">Unit Delivery Status</div>
          <div id="unit-status-list" style="display:flex;flex-direction:column;gap:6px"></div>
        </div>

        <!-- Signal history -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;
            align-items:center;margin-bottom:14px">
            <div class="card-title" style="margin-bottom:0">Signal History</div>
            <button class="btn btn-ghost"
              style="font-size:10px;padding:4px 10px"
              onclick="clearSignalLog()">Clear</button>
          </div>
          <div id="signal-log" style="max-height:200px;overflow-y:auto">
            <div style="color:var(--t3);font-size:12px">No signals sent yet</div>
          </div>
        </div>
      </div>

      <!-- ── Right column: info + controls ─────────────────── -->
      <div style="display:flex;flex-direction:column;gap:16px">

        <!-- Feed info -->
        <div class="card">
          <div class="card-title">Feed Info</div>
          <div id="info-rows"></div>
        </div>

        <!-- ── Real-time exam timer ──────────────────────────
             Shown only when a timer command is confirmed
             delivered to ESP32 (HTTP 200 response).
             State: stopped → running → paused → ended       -->
        <div class="card" id="exam-timer-card">
          <div class="card-title">Exam Timer</div>
          <div class="exam-timer-display" id="timer-display">--:--</div>
          <div class="timer-state-row">
            <span id="timer-state-badge"
              style="font-size:10px;color:var(--t3);
                     font-family:var(--fm);letter-spacing:0.06em">
              WAITING
            </span>
          </div>
          <p style="font-size:10px;color:var(--t3);text-align:center;
            margin-bottom:4px">
            Updates only when ESP32 confirms delivery (↑ green badge)
          </p>
        </div>

        <!-- Exam controls -->
        <div class="card">
          <div class="card-title">Exam Controls</div>
          <p style="font-size:11px;color:var(--t3);margin-bottom:14px">
            Global commands sent to all pen units.
          </p>

          <div class="signal-group">
            <div class="signal-label">Timer</div>
            <div style="display:flex;gap:6px;margin-bottom:6px">
              <input class="input" type="number" id="duration-input"
                placeholder="Minutes" min="1" style="width:120px">
              <button class="btn btn-ghost" onclick="sendTimer()">Set Timer</button>
            </div>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">
            <button class="btn btn-green"  onclick="sendCmd('start')">▶ Start</button>
            <button class="btn btn-ghost"  onclick="sendCmd('pause')">⏸ Pause</button>
            <button class="btn btn-danger" onclick="sendCmd('end')">⏹ End</button>
            <button class="btn btn-ghost"  onclick="sendCmd('reset')">↺ Reset</button>
          </div>

          <hr class="divider">

          <div class="signal-group">
            <div class="signal-label">Unit Actions</div>
            <p style="font-size:11px;color:var(--t3);margin-bottom:10px">
              Target a specific pen unit by ID.
            </p>

            <div style="display:flex;gap:6px;margin-bottom:10px">
              <input class="input" type="number" id="unit-id"
                placeholder="Unit ID" min="1" style="width:100px">
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
              <button class="btn btn-warn"  onclick="sendUnit('warn')">⚠ Warn</button>
              <button class="btn btn-green" onclick="sendUnit('enable')">✓ Enable</button>
            </div>

            <div class="signal-group">
              <div class="signal-label">Disable</div>
              <div style="display:flex;gap:6px;margin-bottom:4px">
                <input class="input" type="number" id="punish-input"
                  placeholder="Penalty (s) — optional" min="0">
                <button class="btn btn-danger" onclick="sendDisable()">Disable</button>
              </div>
            </div>

            <div class="signal-group">
              <div class="signal-label">Deduct Time</div>
              <div style="display:flex;gap:6px">
                <input class="input" type="number" id="deduct-input"
                  placeholder="Seconds to deduct" min="1">
                <button class="btn btn-danger" onclick="sendDeduct()">Deduct</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </main>
</div>

<script src="/js/nav.js"></script>
<script>
  document.getElementById('sidebar').innerHTML = buildSidebar();
  initSidebar();

  const feedId  = window.location.pathname.split('/')[2];
  let signalLog = [];

  // ── Feed data ─────────────────────────────────────────────

  async function loadFeed() {
    const data = await api(`/api/feeds/${feedId}`);
    if (!data) return;

    document.getElementById('crumb-label').textContent = data.label;
    document.getElementById('video-label').textContent = data.label;
    document.getElementById('video-status').textContent =
      data.connected ? 'LIVE FEED' : 'CAMERA OFFLINE';

    const badge = document.getElementById('live-badge');
    if (data.connected) {
      badge.className = 'feed-badge live';
      badge.innerHTML = '<span class="feed-dot"></span> LIVE';
    } else {
      badge.className = 'feed-badge offline';
      badge.innerHTML  = 'OFFLINE';
    }

    const hasAlert = data.detections && data.detections.length > 0;
    document.getElementById('video-wrap').className =
      `video-large ${hasAlert ? 'alert' : ''}`;
    document.getElementById('alert-banner').style.display =
      hasAlert ? 'block' : 'none';

    document.getElementById('info-rows').innerHTML = [
      { label: 'Feed ID',     value: `#${data.id}` },
      { label: 'Label',       value: data.label },
      { label: 'Status',      value: data.connected ? 'Connected' : 'Offline',
        color: data.connected ? 'var(--green)' : 'var(--red)' },
      { label: 'Total Flags', value: data.detections?.length || 0,
        color: data.detections?.length > 0 ? 'var(--amber)' : 'var(--t1)' },
    ].map(r => `
      <div class="info-row">
        <span class="info-label">${r.label}</span>
        <span style="color:${r.color||'var(--t1)'};font-weight:500">
          ${r.value}
        </span>
      </div>`).join('');

    const log = document.getElementById('detection-log');
    if (!data.detections || data.detections.length === 0) {
      log.innerHTML =
        '<div style="color:var(--t3);font-size:12px">No detections</div>';
    } else {
      log.innerHTML = data.detections.map(d => `
        <div style="display:flex;justify-content:space-between;
          align-items:center;padding:6px 0;
          border-bottom:1px solid rgba(0,212,255,0.05)">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="width:6px;height:6px;border-radius:50%;
              background:var(--red);display:inline-block;flex-shrink:0">
            </span>
            <span style="font-size:11px;padding:2px 6px;background:var(--rdim);
              color:var(--red);border-radius:2px;letter-spacing:0.06em">
              ${d.class_label}
            </span>
            <span style="font-size:11px;color:var(--amber)">
              ${(d.confidence*100).toFixed(0)}%
            </span>
          </div>
          <span style="font-size:10px;color:var(--t3)">
            ${new Date(d.detected_at).toLocaleTimeString()}
          </span>
        </div>`).join('');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  REAL-TIME EXAM TIMER
  //
  //  Purely client-side — no backend needed.
  //  Only activates when the server returns HTTP 200 for a
  //  timer or exam-control command, meaning ESP32 confirmed
  //  receipt. A 202 (logged, not delivered) does NOT update
  //  the timer.
  //
  //  States:
  //    stopped  — timer set, not yet started
  //    running  — countdown ticking
  //    paused   — frozen
  //    ended    — reached 0:00 or End command confirmed
  // ════════════════════════════════════════════════════════════

  let timerTotal    = 0;     // total ms set by instructor
  let timerRemain   = 0;     // ms remaining
  let timerState    = 'stopped'; // stopped | running | paused | ended
  let timerInterval = null;  // setInterval handle

  function timerTick() {
    if (timerState !== 'running') return;

    timerRemain = Math.max(0, timerRemain - 1000);
    renderTimer();

    if (timerRemain === 0) {
      timerState = 'ended';
      clearInterval(timerInterval);
      timerInterval = null;
      renderTimer();
    }
  }

  // Format ms → MM:SS
  function fmtMs(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function renderTimer() {
    const card    = document.getElementById('exam-timer-card');
    const display = document.getElementById('timer-display');
    const badge   = document.getElementById('timer-state-badge');

    // Show card only once a timer has been confirmed
    if (timerTotal > 0) card.style.display = 'block';

    display.textContent = fmtMs(timerRemain);

    // Colour shifts: green → amber under 5 min → red when ended
    display.className = 'exam-timer-display';
    if (timerState === 'ended' || timerRemain === 0) {
      display.classList.add('ended');
    } else if (timerRemain < 5 * 60 * 1000) {
      display.classList.add('warn');
    }

    const stateMap = {
      stopped: { label: 'SET — awaiting Start',  color: 'var(--t3)'   },
      running: { label: '● RUNNING',              color: 'var(--green)' },
      paused:  { label: '⏸ PAUSED',              color: 'var(--amber)' },
      ended:   { label: '⏹ ENDED',              color: 'var(--red)'   },
    };
    const s = stateMap[timerState] || stateMap.stopped;
    badge.textContent = s.label;
    badge.style.color = s.color;
  }

  // Called when a confirmed-delivered command should update timer state
  function applyTimerCommand(cmd, durationMs) {
    switch (cmd) {

      case 'timer':
        // Set or reset total time — moves to stopped, waiting for Start
        timerTotal  = durationMs;
        timerRemain = durationMs;
        timerState  = 'stopped';
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        renderTimer();
        break;

      case 'start':
        // Only start if timer was set and not already running
        if (timerTotal > 0 && timerState !== 'running' && timerState !== 'ended') {
          timerState    = 'running';
          timerInterval = setInterval(timerTick, 1000);
          renderTimer();
        }
        break;

      case 'pause':
        if (timerState === 'running') {
          timerState = 'paused';
          if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
          renderTimer();
        }
        break;

      case 'end':
        timerState = 'ended';
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        timerRemain = 0;
        renderTimer();
        break;

      case 'reset':
        // Restore full duration, go back to stopped
        timerRemain = timerTotal;
        timerState  = 'stopped';
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        renderTimer();
        break;

      case 'deduct':
        // Subtract time_ms from remaining (minimum 0)
        // durationMs here is the time_ms from the signal payload
        if (timerTotal > 0) {
          timerRemain = Math.max(0, timerRemain - durationMs);
          if (timerRemain === 0) {
            timerState = 'ended';
            if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
          }
          renderTimer();
        }
        break;
    }
  }

  // ════════════════════════════════════════════════════════════
  //  SIGNAL SENDING
  //
  //  postSignal returns the parsed response and HTTP status.
  //  HTTP 200 → ESP32 confirmed = green "Delivered ✓" badge
  //             Also triggers timer state change if applicable.
  //  HTTP 202 → Logged only, not delivered = amber "Logged" badge
  //  HTTP 4xx/5xx → red "Error" badge
  // ════════════════════════════════════════════════════════════

  async function postSignal(body) {
    let res, data;
    try {
      res  = await fetch('/api/signal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body)
      });
      data = await res.json();
    } catch (err) {
      // Network error — Node.js unreachable
      addSignalLog(body, 'error', 'Network error — server unreachable');
      return;
    }

    if (res.status === 200) {
      // ── Confirmed delivered to ESP32 ──────────────────────
      addSignalLog(body, 'delivered');

      // Update the timer display only on confirmed delivery
      if (body.cmd === 'timer') {
        applyTimerCommand('timer', body.duration_ms);
      } else if (['start','pause','end','reset'].includes(body.cmd)) {
        applyTimerCommand(body.cmd);
      } else if (body.cmd === 'deduct') {
        applyTimerCommand('deduct', body.time_ms);
      }

    } else if (res.status === 202) {
      // ── Logged but not delivered (no ESP32) ───────────────
      addSignalLog(body, 'logged', data.warning);

    } else {
      // ── Validation error or server error ──────────────────
      addSignalLog(body, 'error', data.error || `HTTP ${res.status}`);
    }
  }

  // ── Signal helper wrappers ────────────────────────────────

  function sendCmd(cmd) { postSignal({ cmd }); }

  function sendTimer() {
    const mins = parseInt(document.getElementById('duration-input').value);
    if (!mins || mins <= 0) {
      addSignalLog(null, 'error', 'Enter minutes for timer');
      return;
    }
    postSignal({ cmd: 'timer', duration_ms: mins * 60 * 1000 });
  }

  function getUnitId() {
    const id = parseInt(document.getElementById('unit-id').value);
    if (!id || id <= 0) {
      addSignalLog(null, 'error', 'Enter a unit ID');
      return null;
    }
    return id;
  }

  function sendUnit(cmd) {
    const device_id = getUnitId();
    if (!device_id) return;
    postSignal({ cmd, device_id });
  }

  function sendDisable() {
    const device_id = getUnitId();
    if (!device_id) return;
    const secs = parseInt(document.getElementById('punish-input').value) || 0;
    const body = { cmd: 'disable', device_id };
    if (secs > 0) body.punish_ms = secs * 1000;
    postSignal(body);
  }

  function sendDeduct() {
    const device_id = getUnitId();
    if (!device_id) return;
    const secs = parseInt(document.getElementById('deduct-input').value);
    if (!secs || secs <= 0) {
      addSignalLog(null, 'error', 'Enter seconds to deduct');
      return;
    }
    postSignal({ cmd: 'deduct', device_id, time_ms: secs * 1000 });
  }

  // ── Signal log rendering ──────────────────────────────────
  //
  // status: 'delivered' | 'logged' | 'error'
  // 'delivered' = green — ESP32 confirmed
  // 'logged'    = amber — stored in DB but ESP32 not connected
  // 'error'     = red   — validation or network failure

  function addSignalLog(body, status, note) {
    const cmdStr = body
      ? Object.entries(body)
          .map(([k,v]) => `${k}: ${v}`)
          .join(', ')
      : note || 'unknown';

    signalLog.unshift({ cmdStr, status, note, time: new Date().toLocaleTimeString() });
    renderSignalLog();
  }

  function renderSignalLog() {
    const el = document.getElementById('signal-log');
    if (signalLog.length === 0) {
      el.innerHTML =
        '<div style="color:var(--t3);font-size:12px">No signals sent yet</div>';
      return;
    }

    const badgeLabel = {
      delivered: 'Delivered ✓',
      logged:    'Logged only',
      error:     'Error',
    };

    el.innerHTML = signalLog.slice(0, 40).map((s, i) => `
      <div style="display:flex;justify-content:space-between;
        align-items:flex-start;padding:7px 0;
        border-bottom:1px solid rgba(0,212,255,0.04)">

        <div style="display:flex;align-items:flex-start;gap:8px;flex:1;min-width:0">
          <span style="font-size:10px;color:var(--t3);flex-shrink:0;margin-top:2px">
            ${signalLog.length - i}
          </span>
          <div style="display:flex;flex-direction:column;gap:3px;min-width:0">
            <span style="font-size:11px;color:var(--accent);
              word-break:break-all;letter-spacing:0.04em;font-family:var(--fm)">
              ${s.cmdStr}
            </span>
            ${s.note
              ? `<span style="font-size:10px;color:var(--t3)">${s.note}</span>`
              : ''}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;align-items:flex-end;
          gap:3px;flex-shrink:0;margin-left:8px">
          <span class="sig-badge ${s.status}">${badgeLabel[s.status]}</span>
          <span style="font-size:10px;color:var(--t3)">${s.time}</span>
        </div>

      </div>`).join('');
  }

  function clearSignalLog() {
    signalLog = [];
    renderSignalLog();
  }

  // ════════════════════════════════════════════════════════════
  //  UNIT DELIVERY STATUS PANEL
  //
  //  Tracks last-known delivery state per unit ID.
  //  Updated by two WS message types:
  //
  //  signal_ack  — sent by signals.js immediately after serial
  //                write attempt (confirmed or undelivered).
  //  serial_ack  — forwarded from ESP32 hardware ack JSON.
  //                Only arrives when firmware is updated.
  // ════════════════════════════════════════════════════════════

  const unitStatus = {};

  function updateUnitStatus(unitKey, cmd, status, hwAck) {
    unitStatus[unitKey] = {
      cmd, status, hwAck,
      time: new Date().toLocaleTimeString(),
    };
    renderUnitStatus();
  }

  function renderUnitStatus() {
    const card = document.getElementById('unit-status-card');
    const list = document.getElementById('unit-status-list');
    const entries = Object.entries(unitStatus);
    if (entries.length === 0) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    list.innerHTML = entries.map(([unit, s]) => {
      const sigLabel = s.status === 'delivered' ? 'ESP32 \u2713' : 'Not delivered';
      const sigClass = s.status === 'delivered' ? 'delivered' : 'logged';
      const hwColor  = s.hwAck === 'ok' ? 'var(--green)' : s.hwAck === 'err' ? 'var(--red)' : 'var(--t3)';
      const hwLabel  = s.hwAck === 'ok' ? 'Wemos \u2713' : s.hwAck === 'err' ? 'Wemos \u2717' : 'Wemos \u2014';
      const unitLabel = unit === 'all' ? 'All units' : 'Unit #' + unit;
      return `<div style="display:flex;align-items:center;gap:10px;
          padding:7px 10px;background:var(--raised);
          border:1px solid var(--border);border-radius:6px">
        <span style="font-family:var(--fm);font-size:12px;font-weight:600;
          color:var(--accent);min-width:70px">${unitLabel}</span>
        <span style="font-size:11px;color:var(--t2);flex:1">${s.cmd}</span>
        <span class="sig-badge ${sigClass}">${sigLabel}</span>
        <span style="font-size:9px;padding:1px 6px;border-radius:3px;
          font-family:var(--fm);font-weight:600;letter-spacing:0.06em;
          color:${hwColor};background:rgba(255,255,255,0.05);
          border:1px solid ${hwColor}30">${hwLabel}</span>
        <span style="font-size:10px;color:var(--t3);flex-shrink:0">${s.time}</span>
      </div>`;
    }).join('');
  }

  // ── WebSocket — camera frames + ack messages ──────────────
  const ws = new WebSocket(
    `${window.location.origin.replace('http','ws').replace('https','wss')}/ws?role=dashboard`
  );
  ws.binaryType = 'arraybuffer';

  ws.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      const view = new DataView(event.data);
      const incomingFeedId = view.getUint32(0);
      if (incomingFeedId != feedId) return;
      const blob = new Blob([event.data.slice(4)], { type: 'image/jpeg' });
      const url  = URL.createObjectURL(blob);
      const wrap = document.getElementById('video-wrap');
      let img = document.getElementById('live-video-stream');
      if (!img) {
        wrap.innerHTML = '';
        img = document.createElement('img');
        img.id = 'live-video-stream';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
        wrap.appendChild(img);
      }
      const old = img.src;
      img.src = url;
      if (old.startsWith('blob:')) URL.revokeObjectURL(old);
      document.getElementById('video-status').textContent = 'LIVE FEED';
      return;
    }

    let msg;
    try { msg = JSON.parse(event.data); } catch (_) { return; }

    if (msg.type === 'signal_ack') {
      // Broadcast from signals.js after each serial write attempt
      const unitKey = msg.unit !== undefined ? String(msg.unit) : 'all';
      updateUnitStatus(unitKey, msg.cmd, msg.status, null);
    }

    if (msg.type === 'serial_ack') {
      // Hardware echo from ESP32 firmware (requires firmware update)
      const unitKey = msg.unit !== undefined ? String(msg.unit) : 'all';
      if (unitStatus[unitKey]) {
        unitStatus[unitKey].hwAck = msg.ack;
        renderUnitStatus();
      } else {
        updateUnitStatus(unitKey, msg.cmd || '?', 'delivered', msg.ack);
      }
    }
  };

  ws.onclose = () => {
    setTimeout(() => window.location.reload(), 3000);
  };

  // ── Init ──────────────────────────────────────────────────
  loadFeed();
</script>
</body>
</html>
```` 
### 7.1.12 public/dashboard.html  
````html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proctor — Dashboard</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    .live-stream-img {
      width:100%;height:100%;object-fit:cover;display:block;background:#0d1117;
    }

    /* ── Central exam timer bar ────────────────────────────── */
    /* Sits between session banner and feed grid.
       Hidden until a 'start' signal is confirmed delivered.   */
    #exam-timer-bar {
      display: none;
      align-items: center;
      gap: 16px;
      padding: 12px 18px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-bottom: 16px;
    }

    /* Clicking the timer opens the adjust modal */
    #timer-display-btn {
      font-family: var(--fm);
      font-size: 2.4rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--green);
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      transition: color 0.3s, opacity 0.15s;
      line-height: 1;
    }
    #timer-display-btn:hover { opacity: 0.75; }
    #timer-display-btn.warn  { color: var(--amber); }
    #timer-display-btn.ended { color: var(--red);   }

    .timer-meta {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .timer-state-label {
      font-size: 10px;
      font-family: var(--fm);
      letter-spacing: 0.10em;
      font-weight: 600;
    }
    .timer-hint {
      font-size: 10px;
      color: var(--t3);
    }

    /* ── Adjust-time modal ─────────────────────────────────── */
    #adjust-modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 200;
      align-items: center;
      justify-content: center;
    }
    #adjust-modal-overlay.open { display: flex; }
    #adjust-modal {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 26px 30px;
      width: min(380px, 95vw);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    #adjust-modal h3 {
      font-family: var(--fd);
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
<div class="layout">
  <div id="sidebar" style="min-width:200px;width:200px;flex-shrink:0"></div>

  <main class="main">
    <div class="page-header">
      <div>
        <div class="page-title">Live Feeds</div>
        <div class="page-sub" id="feed-summary">Loading...</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-ghost" id="filter-all"
          onclick="setFilter('all')">All</button>
        <button class="btn btn-ghost" id="filter-live"
          onclick="setFilter('live')">Live</button>
        <button class="btn btn-ghost" id="filter-alert"
          onclick="setFilter('alert')">Alerts</button>
        <hr style="width:1px;height:20px;border:none;border-left:1px solid var(--border)">
        <a href="/allsessions" class="btn btn-primary"
          style="font-size:11px;padding:6px 14px">
          + New Session
        </a>
      </div>
    </div>

    <!-- Active session banner -->
    <div class="session-banner" id="session-banner" style="display:none">
      <div class="session-dot"></div>
      <div>
        <div class="session-name" id="banner-name">—</div>
        <div class="session-meta" id="banner-meta">—</div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════
         CENTRAL EXAM TIMER BAR
         Hidden until a 'start' signal_ack with status='delivered'
         arrives. Shows countdown for all pen units simultaneously.
         Click the time display to open the adjust modal.
    ══════════════════════════════════════════════════════════ -->
    <div id="exam-timer-bar">

      <!-- Clickable timer display -->
      <button id="timer-display-btn" onclick="openAdjustModal()"
        title="Click to adjust time">
        --:--
      </button>

      <!-- State label + hint -->
      <div class="timer-meta">
        <span class="timer-state-label" id="timer-state-label"
          style="color:var(--t3)">
          WAITING
        </span>
        <span class="timer-hint">Central exam timer — all units</span>
        <span class="timer-hint" style="color:var(--accent)">
          Click time to adjust ↑
        </span>
      </div>

      <!-- Spacer -->
      <div style="flex:1"></div>

      <!-- Manual controls for when ESP32 is not connected
           (mirrors candidate page controls for the proctor) -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-ghost" style="font-size:11px;padding:5px 12px"
          onclick="localTimerCmd('pause')">⏸</button>
        <button class="btn btn-ghost" style="font-size:11px;padding:5px 12px"
          onclick="localTimerCmd('start')">▶</button>
        <button class="btn btn-ghost" style="font-size:11px;padding:5px 12px"
          onclick="localTimerCmd('end')">⏹</button>
      </div>

    </div>

    <!-- WS reconnecting notice -->
    <div id="ws-status" style="
      display:none;padding:8px 14px;
      background:rgba(255,176,32,0.08);
      border:1px solid rgba(255,176,32,0.25);
      border-radius:8px;font-size:11px;
      color:var(--amber);margin-bottom:12px">
      ⚠ Live feed connection lost — reconnecting...
    </div>

    <!-- Feed grid -->
    <div class="feed-grid" id="feed-grid">
      <div style="color:var(--t3);font-size:12px">Loading feeds...</div>
    </div>

  </main>
</div>

<!-- ════════════════════════════════════════════════════════════
     ADJUST TIME MODAL
     Opens when proctor clicks the timer display.
     Allows setting remaining time directly (minutes + seconds).
     Does NOT send a signal — only adjusts local countdown.
     To send a new timer signal, use the candidate page.
════════════════════════════════════════════════════════════ -->
<div id="adjust-modal-overlay">
  <div id="adjust-modal">
    <h3>Adjust Timer</h3>

    <p style="font-size:12px;color:var(--t3);margin-top:-8px">
      Sets the remaining time shown on this dashboard.
      This does NOT send a command to pen units — use the
      candidate page to resend a timer signal to hardware.
    </p>

    <div style="display:flex;align-items:center;gap:10px">
      <div style="display:flex;flex-direction:column;gap:4px;flex:1">
        <label style="font-size:11px;color:var(--t3)">Minutes</label>
        <input class="input" type="number" id="adj-minutes"
          min="0" max="300" placeholder="0" style="font-size:1.4rem;
          text-align:center;padding:10px">
      </div>
      <span style="font-size:1.6rem;color:var(--t3);padding-top:20px">:</span>
      <div style="display:flex;flex-direction:column;gap:4px;flex:1">
        <label style="font-size:11px;color:var(--t3)">Seconds</label>
        <input class="input" type="number" id="adj-seconds"
          min="0" max="59" placeholder="0" style="font-size:1.4rem;
          text-align:center;padding:10px">
      </div>
    </div>

    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="closeAdjustModal()">
        Cancel
      </button>
      <button class="btn btn-primary" onclick="applyAdjust()">
        Set Time
      </button>
    </div>
  </div>
</div>

<script src="/js/nav.js"></script>
<script>
  document.getElementById('sidebar').innerHTML = buildSidebar();
  initSidebar();

  let allFeeds     = [];
  let activeFilter = 'all';

  // ── Session banner ────────────────────────────────────────

  async function loadSessionBanner() {
    const data = await api('/api/sessions/active');
    if (!data || !data.session) {
      document.getElementById('session-banner').style.display = 'none';
      return;
    }
    const s = data.session;
    document.getElementById('session-banner').style.display = 'flex';
    document.getElementById('banner-name').textContent = s.name;
    const parts = [];
    if (s.course_name)     parts.push(s.course_name);
    if (s.instructor_name) parts.push(s.instructor_name);
    if (s.time_block)      parts.push(s.time_block);
    document.getElementById('banner-meta').textContent = parts.join(' · ');
  }

  // ════════════════════════════════════════════════════════════
  //  CENTRAL EXAM TIMER
  //
  //  State machine — mirrors candidate page logic but driven
  //  by signal_ack WS messages instead of button clicks.
  //
  //  Only activates on confirmed delivery (status='delivered').
  //  A 202 (undelivered) does NOT start the timer.
  //
  //  timerTotal:  total ms set by last 'timer' command
  //  timerRemain: ms remaining right now
  //  timerState:  'idle' | 'set' | 'running' | 'paused' | 'ended'
  // ════════════════════════════════════════════════════════════

  let timerTotal    = 0;
  let timerRemain   = 0;
  let timerState    = 'idle';
  let timerInterval = null;

  // Format ms → MM:SS
  function fmtMs(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  }

  function timerTick() {
    if (timerState !== 'running') return;
    timerRemain = Math.max(0, timerRemain - 1000);
    renderTimer();
    if (timerRemain === 0) {
      timerState = 'ended';
      clearInterval(timerInterval);
      timerInterval = null;
      renderTimer();
    }
  }

  function renderTimer() {
    const bar     = document.getElementById('exam-timer-bar');
    const display = document.getElementById('timer-display-btn');
    const stLabel = document.getElementById('timer-state-label');

    // Show bar once timer has been set at least once
    if (timerState !== 'idle') bar.style.display = 'flex';

    display.textContent = timerState === 'idle' ? '--:--' : fmtMs(timerRemain);

    // Colour
    display.className = '';
    if (timerState === 'ended' || timerRemain === 0) {
      display.classList.add('ended');
    } else if (timerRemain < 5 * 60 * 1000 && timerState === 'running') {
      display.classList.add('warn');
    }

    // State label
    const stateMap = {
      idle:    { label: 'WAITING',     color: 'var(--t3)'   },
      set:     { label: 'SET',         color: 'var(--t3)'   },
      running: { label: '● RUNNING',   color: 'var(--green)' },
      paused:  { label: '⏸ PAUSED',   color: 'var(--amber)' },
      ended:   { label: '⏹ ENDED',   color: 'var(--red)'   },
    };
    const st = stateMap[timerState] || stateMap.idle;
    stLabel.textContent = st.label;
    stLabel.style.color = st.color;
  }

  // Apply a confirmed-delivered command to the timer state
  function applyTimerSignal(cmd, durationMs) {
    switch (cmd) {
      case 'timer':
        // Set total time, go to 'set' — awaiting start command
        timerTotal  = durationMs;
        timerRemain = durationMs;
        timerState  = 'set';
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        break;

      case 'start':
        // Start ticking if timer was set and not already running/ended
        if (timerState === 'set' || timerState === 'paused') {
          timerState    = 'running';
          timerInterval = setInterval(timerTick, 1000);
        } else if (timerState === 'idle') {
          // Start pressed without a prior timer command.
          // Show the bar as running but with no countdown (no total set).
          timerState = 'running';
          timerInterval = setInterval(timerTick, 1000);
        }
        break;

      case 'pause':
        if (timerState === 'running') {
          timerState = 'paused';
          if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        }
        break;

      case 'end':
        timerState  = 'ended';
        timerRemain = 0;
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        break;

      case 'reset':
        timerRemain = timerTotal;
        timerState  = timerTotal > 0 ? 'set' : 'idle';
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        break;

      case 'deduct':
        // durationMs here is the time_ms value from the signal
        if (timerTotal > 0) {
          timerRemain = Math.max(0, timerRemain - durationMs);
          if (timerRemain === 0) {
            timerState = 'ended';
            if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
          }
        }
        break;
    }
    renderTimer();
  }

  // Manual override buttons in the timer bar (no ESP32 signal sent)
  function localTimerCmd(cmd) {
    applyTimerSignal(cmd, 0);
  }

  // ── Adjust Time Modal ─────────────────────────────────────

  function openAdjustModal() {
    // Pre-fill with current remaining time
    const totalSec = Math.ceil(timerRemain / 1000);
    document.getElementById('adj-minutes').value = Math.floor(totalSec / 60);
    document.getElementById('adj-seconds').value = totalSec % 60;
    document.getElementById('adjust-modal-overlay').classList.add('open');
    document.getElementById('adj-minutes').focus();
    document.getElementById('adj-minutes').select();
  }

  function closeAdjustModal() {
    document.getElementById('adjust-modal-overlay').classList.remove('open');
  }

  function applyAdjust() {
    const mins = parseInt(document.getElementById('adj-minutes').value) || 0;
    const secs = parseInt(document.getElementById('adj-seconds').value) || 0;
    const newMs = (mins * 60 + secs) * 1000;

    if (newMs < 0) return;

    timerRemain = newMs;
    // If we're setting time while idle, move to 'set' state
    if (timerState === 'idle' && newMs > 0) {
      timerTotal = newMs;
      timerState = 'set';
    }
    // If ended but proctor adds time, resume paused state
    if (timerState === 'ended' && newMs > 0) {
      timerState = 'paused';
      if (!timerTotal) timerTotal = newMs;
    }

    renderTimer();
    closeAdjustModal();
  }

  // Close modal on backdrop click
  document.getElementById('adjust-modal-overlay')
    .addEventListener('click', e => {
      if (e.target.id === 'adjust-modal-overlay') closeAdjustModal();
    });

  // Allow Enter key in modal inputs
  ['adj-minutes','adj-seconds'].forEach(id => {
    document.getElementById(id)
      .addEventListener('keydown', e => { if (e.key === 'Enter') applyAdjust(); });
  });

  // ── Feed loading ──────────────────────────────────────────

  async function loadFeeds() {
    const data = await api('/api/feeds');
    if (!data) return;
    allFeeds = data;
    renderFeeds();
  }

  function setFilter(f) {
    activeFilter = f;
    ['all','live','alert'].forEach(key => {
      const btn = document.getElementById(`filter-${key}`);
      btn.style.background  = key === f ? 'var(--adim)' : '';
      btn.style.color       = key === f ? 'var(--accent)' : '';
      btn.style.borderColor = key === f ? 'var(--accent)' : '';
    });
    renderFeeds();
  }

  function renderFeeds() {
    const liveCount  = allFeeds.filter(f => f.connected).length;
    const alertCount = allFeeds.filter(f => Number(f.alert_count) > 0).length;
    document.getElementById('feed-summary').textContent =
      `${liveCount} connected · ${alertCount} flagged`;

    let filtered = allFeeds;
    if (activeFilter === 'live')  filtered = allFeeds.filter(f => f.connected);
    if (activeFilter === 'alert') filtered = allFeeds.filter(f => Number(f.alert_count) > 0);

    const grid = document.getElementById('feed-grid');
    if (filtered.length === 0) {
      grid.innerHTML = `<div style="color:var(--t3);font-size:12px;padding:40px 0">
        No feeds match this filter</div>`;
      return;
    }

    grid.innerHTML = filtered.map(feed => {
      const alerts     = Number(feed.alert_count);
      const hasAlert   = alerts > 0;
      const isLive     = feed.connected;
      const badgeClass = !isLive ? 'offline' : hasAlert ? 'alert' : 'live';
      const badgeText  = !isLive ? 'OFFLINE'  : hasAlert ? 'ALERT'  : 'LIVE';
      const cardClass  = !isLive ? 'offline'  : hasAlert ? 'alert'  : '';

      return `
        <div class="feed-card ${cardClass}" id="card-${feed.id}">
          <a href="/candidate/${feed.id}"
            style="text-decoration:none;color:inherit;display:block">
            <div class="feed-video">
              ${isLive
                ? `<div style="position:relative;width:100%;height:100%;
                               background:#0d1117;display:flex;
                               align-items:center;justify-content:center;">
                     <img id="live-feed-${feed.id}"
                       class="live-stream-img" src="" alt="${feed.label}">
                     <div id="await-${feed.id}"
                       style="position:absolute;font-size:10px;
                              letter-spacing:0.10em;color:#445566;
                              font-family:monospace;pointer-events:none">
                       AWAITING FEED
                     </div>
                   </div>`
                : `<div class="feed-placeholder">
                     <div class="feed-icon">◈</div>
                     <div class="feed-status-text">OFFLINE</div>
                   </div>`
              }
              <div class="feed-badge ${badgeClass}">
                ${isLive ? '<span class="feed-dot"></span>' : ''}${badgeText}
              </div>
            </div>
            <div class="feed-footer"
              style="display:flex;align-items:center;
                     justify-content:space-between;gap:6px">
              <div class="feed-name" style="flex-shrink:0">${feed.label}</div>
              <div style="flex:1;text-align:center">
                ${hasAlert
                  ? `<span class="feed-flags">${alerts} flag${alerts>1?'s':''}</span>`
                  : `<span style="font-size:10px;color:var(--t3)">Clear</span>`
                }
              </div>
              <button
                onclick="event.stopPropagation();event.preventDefault();
                  removeFeed(${feed.id},'${feed.label}')"
                style="flex-shrink:0;width:auto;padding:3px 8px;font-size:9px;
                  background:transparent;border:1px solid rgba(255,59,59,0.3);
                  color:var(--red);border-radius:3px;cursor:pointer;
                  font-family:var(--fm);letter-spacing:0.06em">
                ✕ REMOVE
              </button>
            </div>
          </a>
        </div>`;
    }).join('');
  }

  // ── Dashboard WebSocket — exponential backoff reconnect ───
  // Does NOT use location.reload() — prevents the freeze loop.

  let dashWs             = null;
  let wsRetryDelay       = 1000;
  let wsRetryTimer       = null;
  let wsIntentionalClose = false;

  function connectDashWs() {
    if (wsRetryTimer) { clearTimeout(wsRetryTimer); wsRetryTimer = null; }

    const url = `${window.location.origin
      .replace('http','ws')
      .replace('https','wss')}/ws?role=dashboard`;

    dashWs            = new WebSocket(url);
    dashWs.binaryType = 'arraybuffer';

    dashWs.onopen = () => {
      document.getElementById('ws-status').style.display = 'none';
      wsRetryDelay = 1000;
    };

    dashWs.onmessage = (event) => {
      // ── Binary: camera JPEG frame ────────────────────────
      if (event.data instanceof ArrayBuffer) {
        const view   = new DataView(event.data);
        const feedId = view.getUint32(0);
        const blob   = new Blob([event.data.slice(4)], { type: 'image/jpeg' });
        const url    = URL.createObjectURL(blob);
        const img    = document.getElementById(`live-feed-${feedId}`);
        if (img) {
          const old = img.src;
          img.src = url;
          if (old.startsWith('blob:')) URL.revokeObjectURL(old);
          const awaitEl = document.getElementById(`await-${feedId}`);
          if (awaitEl) awaitEl.style.display = 'none';
        } else {
          URL.revokeObjectURL(url);
        }
        return;
      }

      // ── JSON messages ────────────────────────────────────
      let msg;
      try { msg = JSON.parse(event.data); } catch (_) { return; }

      if (msg.type === 'feed_connected' || msg.type === 'feed_disconnected') {
        loadFeeds();
        return;
      }

      // signal_ack: broadcast from signals.js after each serial write.
      // Only update the central timer on confirmed delivery (status='delivered').
      // An undelivered signal (202 response) does NOT start the countdown.
      if (msg.type === 'signal_ack' && msg.status === 'delivered') {
        applyTimerSignal(msg.cmd, msg.duration_ms || msg.time_ms || 0);
      }
    };

    dashWs.onclose = (event) => {
      if (wsIntentionalClose) return;
      document.getElementById('ws-status').style.display = 'block';
      wsRetryTimer = setTimeout(() => {
        connectDashWs();
        wsRetryDelay = Math.min(wsRetryDelay * 2, 30000);
      }, wsRetryDelay);
    };

    dashWs.onerror = () => {};
  }

  window.addEventListener('beforeunload', () => {
    wsIntentionalClose = true;
    if (dashWs) dashWs.close();
  });

  // ── Feed removal ──────────────────────────────────────────

  async function removeFeed(id, label) {
    if (!confirm(`Remove "${label}" from dashboard?`)) return;
    const res  = await fetch(`/api/feeds/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) loadFeeds();
    else alert('Error: ' + data.error);
  }

  // ── Init ──────────────────────────────────────────────────

  connectDashWs();
  loadSessionBanner();
  loadFeeds();
  setInterval(loadFeeds, 5000);
  setInterval(loadSessionBanner, 30000);
  renderTimer(); // initialise display to --:--
</script>
</body>
</html>
```` 
### 7.1.13 public/history.html 
````html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proctor — Signal History</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
<div class="layout">
  <div id="sidebar" style="min-width:200px;width:200px;flex-shrink:0"></div>

  <main class="main">
    <div class="page-header">
      <div>
        <div class="page-title">Signal History</div>
        <div class="page-sub" id="history-summary">Loading...</div>
      </div>
      <button class="btn btn-ghost" onclick="exportCSV()">↓ Export CSV</button>
    </div>

    <!-- Note about legacy signals without session names -->
    <div id="legacy-note" style="
      display:none;
      padding:10px 14px;
      background:rgba(255,176,32,0.08);
      border:1px solid rgba(255,176,32,0.25);
      border-radius:8px;
      font-size:11px;
      color:var(--amber);
      margin-bottom:12px">
      ℹ Some signals show "—" in the Session column. These were sent before
      session tracking was enabled. New signals will show their session name.
    </div>

    <!-- Filters -->
    <div class="filter-bar">

      <!-- Date picker — selecting a date filters the session dropdown -->
      <div class="filter-group">
        <label>Date</label>
        <input class="input" type="date" id="filter-date"
          style="padding:7px 10px;font-size:12px"
          oninput="onDateChange()">
      </div>

      <!-- Session dropdown — reduced by date if selected -->
      <div class="filter-group" style="min-width:200px">
        <label>
          Session
          <span id="session-hint"
            style="color:var(--t3);font-size:10px;
                   margin-left:4px;font-weight:400">
          </span>
        </label>
        <select class="input" id="filter-session"
          style="padding:7px 10px;font-size:12px">
          <!-- Static options — always present -->
          <option value="active">Active session</option>
          <option value="all">All sessions</option>
          <!-- Dynamic session options added by populateSessionDropdown() -->
        </select>
      </div>

      <div class="filter-group">
        <label>Source</label>
        <select class="input" id="filter-source" style="padding:7px 10px;font-size:12px">
          <option value="all">All sources</option>
          <option value="admin">Candidate page</option>
          <option value="pen_app">Pen app</option>
        </select>
      </div>

      <div class="filter-group">
        <label>Command</label>
        <select class="input" id="filter-cmd" style="padding:7px 10px;font-size:12px">
          <option value="all">All commands</option>
          <option value="start">start</option>
          <option value="pause">pause</option>
          <option value="end">end</option>
          <option value="reset">reset</option>
          <option value="timer">timer</option>
          <option value="warn">warn</option>
          <option value="disable">disable</option>
          <option value="enable">enable</option>
          <option value="deduct">deduct</option>
        </select>
      </div>

      <button class="btn btn-ghost" style="align-self:flex-end"
        onclick="applyFilters()">
        ⟳ Apply
      </button>

      <!-- Client-side hide — no DB changes -->
      <button class="btn btn-ghost" style="align-self:flex-end"
        onclick="hideVisible()"
        title="Hide currently shown signals from view (stored locally, no DB change)">
        ⊘ Hide Shown
      </button>

      <!-- Restore all client-side hidden signals -->
      <button class="btn btn-ghost" style="align-self:flex-end"
        onclick="restoreHidden()"
        title="Bring back all signals hidden from view">
        ↺ Restore All
      </button>

    </div>

    <!-- Results container — rendered by renderGrouped() -->
    <div id="history-container">
      <div style="color:var(--t3);font-size:12px;
        padding:40px 0;text-align:center">
        Loading...
      </div>
    </div>

  </main>
</div>

<script src="/js/nav.js"></script>
<script>
  document.getElementById('sidebar').innerHTML = buildSidebar();
  initSidebar();

  // ── State ─────────────────────────────────────────────────
  let allEntries      = [];           // current batch from API
  let activeSessionId = null;         // currently active exam session
  let allSessions     = [];           // all sessions for dropdown

  // Hidden entry IDs — persisted in localStorage so they survive
  // page refreshes. Client-side only — no DB changes.
  let hiddenIds = new Set(
    JSON.parse(localStorage.getItem('history-hidden') || '[]')
  );

  // ── Bootstrap ─────────────────────────────────────────────
  async function init() {
    // Get active session ID for the "Active session" dropdown option
    const active    = await api('/api/sessions/active');
    activeSessionId = active?.session?.id || null;

    // Load all sessions so the dropdown can be filtered by date
    const sessData = await api('/api/sessions');
    allSessions    = sessData?.sessions || [];

    populateSessionDropdown(allSessions);
    applyFilters();
  }

  // ── Session dropdown ──────────────────────────────────────
  // Rebuilds the dynamic part of the dropdown from the given list.
  // Called on init and whenever the date picker changes.
  function populateSessionDropdown(sessions) {
    const sel = document.getElementById('filter-session');

    // Remove all dynamic options (keep "Active session" and "All sessions")
    while (sel.options.length > 2) sel.remove(2);

    sessions.forEach(s => {
      const opt   = document.createElement('option');
      opt.value   = s.id;
      opt.text    = s.name + (s.ended_at ? '' : ' ● active');
      // Pre-select the active session if present
      if (s.id === activeSessionId) opt.selected = true;
      sel.appendChild(opt);
    });

    // Update hint text to show filter is active
    const hint = document.getElementById('session-hint');
    hint.textContent = sessions.length < allSessions.length
      ? `(${sessions.length} on this date)`
      : '';
  }

  // ── Date change handler ───────────────────────────────────
  // Filters session dropdown to only show sessions that were
  // active on the selected date. If no date, shows all sessions.
  function onDateChange() {
    const dateVal = document.getElementById('filter-date').value;

    if (!dateVal) {
      // No date selected — restore full session list
      populateSessionDropdown(allSessions);
      return;
    }

    const dayStart = new Date(dateVal); dayStart.setHours(0,  0,  0,   0);
    const dayEnd   = new Date(dateVal); dayEnd.setHours(  23, 59, 59, 999);

    const matching = allSessions.filter(s => {
      const start = new Date(s.created_at);
      // Active sessions: treat end as now (they extend to current time)
      const end   = s.ended_at ? new Date(s.ended_at) : new Date();
      // Session overlaps the selected calendar day
      return start <= dayEnd && end >= dayStart;
    });

    populateSessionDropdown(matching);

    // Auto-select "all" if no sessions match — avoids confusing empty result
    if (matching.length === 0) {
      document.getElementById('filter-session').value = 'all';
    }
  }

  // ── Apply filters → fetch from API ───────────────────────
  async function applyFilters() {
    const sessionVal = document.getElementById('filter-session').value;
    const source     = document.getElementById('filter-source').value;
    const cmd        = document.getElementById('filter-cmd').value;
    const date       = document.getElementById('filter-date').value;

    const params = new URLSearchParams();

    // Resolve session dropdown value to an actual session_id param
    if (sessionVal === 'active') {
      // "Active session" — only pass param if we know the active session id
      if (activeSessionId) params.set('sessionId', activeSessionId);
      // else: no sessionId param → backend returns all (correct for no-session state)
    } else if (sessionVal !== 'all') {
      // A specific numeric session id was selected
      params.set('sessionId', sessionVal);
    }
    // 'all' → no sessionId param → backend returns all signals

    if (date)             params.set('date',   date);
    if (source !== 'all') params.set('source', source);
    if (cmd    !== 'all') params.set('cmd',    cmd);

    const data = await api(`/api/history?${params}`);
    if (!data) return;

    allEntries = data.entries;

    // Show legacy note if any entry has a null session_name
    const hasLegacy = allEntries.some(e => !e.session_name);
    document.getElementById('legacy-note').style.display =
      hasLegacy ? 'block' : 'none';

    renderVisible();
  }

  // ── Render only non-hidden entries ────────────────────────
  function renderVisible() {
    const visible = allEntries.filter(e => !hiddenIds.has(e.id));

    document.getElementById('history-summary').textContent =
      `${visible.length} signal${visible.length !== 1 ? 's' : ''} shown` +
      (hiddenIds.size > 0 ? ` · ${hiddenIds.size} hidden` : '');

    renderGrouped(visible);
  }

  // ── Hide Shown: mark all currently visible as hidden ──────
  // Stored in localStorage — survives page reload, no DB change.
  function hideVisible() {
    allEntries
      .filter(e => !hiddenIds.has(e.id))
      .forEach(e => hiddenIds.add(e.id));
    localStorage.setItem('history-hidden', JSON.stringify([...hiddenIds]));
    renderVisible();
  }

  // ── Restore All: clear the hidden set ─────────────────────
  function restoreHidden() {
    hiddenIds.clear();
    localStorage.removeItem('history-hidden');
    renderVisible();
  }

  // ── Group entries by calendar date and render ─────────────
  function renderGrouped(entries) {
    const container = document.getElementById('history-container');

    if (entries.length === 0) {
      container.innerHTML = `
        <div style="color:var(--t3);font-size:12px;
          padding:40px 0;text-align:center">
          No signals found
          ${hiddenIds.size > 0
            ? `<span style="margin-left:8px">
                <button class="btn btn-ghost"
                  style="font-size:11px;padding:3px 10px"
                  onclick="restoreHidden()">
                  ↺ Restore ${hiddenIds.size} hidden
                </button>
               </span>`
            : ''}
        </div>`;
      return;
    }

    // Group by local date string e.g. "14 Apr 2026"
    const groups = {};
    entries.forEach(e => {
      const d   = new Date(e.ts);
      const key = d.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });

    container.innerHTML = Object.entries(groups).map(([date, rows]) => `
      <div style="margin-bottom:20px">

        <!-- Date group header -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <span style="font-family:var(--fd);font-size:13px;font-weight:700;
            letter-spacing:0.10em;color:var(--accent);text-transform:uppercase">
            ${date}
          </span>
          <span style="font-size:10px;color:var(--t3);background:var(--adim);
            border:1px solid var(--border);border-radius:3px;padding:1px 7px">
            ${rows.length} signal${rows.length !== 1 ? 's' : ''}
          </span>
          <div style="flex:1;height:1px;background:var(--border)"></div>
        </div>

        <div class="card" style="padding:0;overflow:hidden">
          <table class="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Session</th>
                <th>Command</th>
                <th>Target</th>
                <th>Params</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(renderRow).join('')}
            </tbody>
          </table>
        </div>

      </div>`
    ).join('');
  }

  // ── Colour / label maps ───────────────────────────────────
  const CMD_COLOR = {
    start:   'var(--green)', enable:  'var(--green)',
    pause:   'var(--amber)', warn:    'var(--amber)',
    timer:   'var(--accent)',
    end:     'var(--red)',   disable: 'var(--red)',
    deduct:  'var(--red)',   reset:   'var(--t2)',
  };
  const CMD_LABEL = {
    start: 'Start',    pause:   'Pause',    end:    'End',
    reset: 'Reset',    timer:   'Set Timer',warn:   'Warn',
    disable: 'Disable', enable: 'Enable',   deduct: 'Deduct',
  };

  // ── Render a single table row ─────────────────────────────
  function renderRow(e) {
    const time    = new Date(e.ts).toLocaleTimeString();
    const color   = CMD_COLOR[e.cmd] || 'var(--t2)';
    const label   = CMD_LABEL[e.cmd] || e.cmd;

    // session_name is populated for signals sent after signals_v4.js
    // was applied. Legacy signals will have null → show "—" in amber
    // as a distinct visual cue from normal "—" cells.
    const session = e.session_name
      ? `<span style="color:var(--accent)">${e.session_name}</span>`
      : `<span style="color:var(--amber);font-size:10px"
           title="Signal sent before session tracking was enabled">
           legacy
         </span>`;

    const target = e.params?.device_id
      ? `<span style="color:var(--accent);font-family:var(--fm)">
           Unit #${e.params.device_id}
         </span>`
      : `<span style="color:var(--t3)">All units</span>`;

    // Build params summary string
    const extras = [];
    if (e.params?.duration_ms)
      extras.push(`${Math.round(e.params.duration_ms / 60000)}m`);
    if (e.params?.time_ms)
      extras.push(`−${Math.round(e.params.time_ms / 1000)}s`);
    if (e.params?.punish_ms)
      extras.push(`penalty ${Math.round(e.params.punish_ms / 1000)}s`);
    if (e.params?.transport)
      extras.push(`via ${e.params.transport}`);
    const paramsStr = extras.length
      ? `<span style="color:var(--t2);font-size:11px">
           ${extras.join(' · ')}
         </span>`
      : `<span style="color:var(--t3)">—</span>`;

    const srcLabel = e.sent_by === 'pen_app' ? 'Pen App' : 'Candidate Page';
    const srcColor = e.sent_by === 'pen_app' ? '#7c6fff'  : 'var(--accent)';
    const srcBg    = e.sent_by === 'pen_app'
      ? 'rgba(124,111,255,0.15)'
      : 'var(--adim)';

    return `<tr>
      <td style="color:var(--t2);font-family:var(--fm);font-size:11px">
        ${time}
      </td>
      <td style="font-size:11px">${session}</td>
      <td>
        <span style="padding:2px 8px;border-radius:3px;font-size:11px;
          font-weight:600;letter-spacing:0.06em;
          background:rgba(255,255,255,0.04);color:${color}">
          ${label}
        </span>
      </td>
      <td>${target}</td>
      <td>${paramsStr}</td>
      <td>
        <span style="padding:2px 8px;border-radius:3px;font-size:10px;
          font-weight:600;letter-spacing:0.06em;
          background:${srcBg};color:${srcColor}">
          ${srcLabel}
        </span>
      </td>
    </tr>`;
  }

  // ── CSV export — only exports currently visible entries ───
  function exportCSV() {
    const visible = allEntries.filter(e => !hiddenIds.has(e.id));
    if (!visible.length) return;

    const headers = ['Time', 'Session', 'Command', 'Target', 'Params', 'Source'];
    const rows    = visible.map(e => [
      new Date(e.ts).toISOString(),
      e.session_name || 'legacy',
      e.cmd,
      e.params?.device_id ? `Unit #${e.params.device_id}` : 'All units',
      [
        e.params?.duration_ms
          ? `${Math.round(e.params.duration_ms / 60000)}m` : '',
        e.params?.time_ms
          ? `-${Math.round(e.params.time_ms / 1000)}s` : '',
        e.params?.transport || '',
      ].filter(Boolean).join(' '),
      e.sent_by,
    ]);

    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `signals_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Start ─────────────────────────────────────────────────
  init();
</script>
</body>
</html>
````  
### 7.1.14 public/incidents.html
````html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proctor — Incidents</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
<div class="layout">
  <div id="sidebar" style="min-width:200px;width:200px;flex-shrink:0"></div>

  <main class="main">
    <div class="page-header">
      <div>
        <div class="page-title">Incident Log</div>
        <div class="page-sub">Full audit trail of all flagged detections</div>
      </div>
      <button class="btn btn-ghost" onclick="exportCSV()">↓ Export CSV</button>
    </div>

    <!-- Filters -->
    <div class="filter-bar">

      <!-- Session dropdown — populated from all sessions -->
      <div class="filter-group">
        <label>Session</label>
        <select class="input" id="filter-session"
          style="padding:7px 10px;font-size:12px"
          onchange="onSessionChange()">
          <option value="active">Active session</option>
          <option value="all">All sessions</option>
          <!-- Dynamic session options added on init -->
        </select>
      </div>

      <!-- Feed dropdown — repopulated when session changes -->
      <div class="filter-group">
        <label>
          Feed
          <span id="feed-hint"
            style="color:var(--t3);font-size:10px;margin-left:4px;font-weight:400">
          </span>
        </label>
        <select class="input" id="filter-feed"
          style="padding:7px 10px;font-size:12px">
          <option value="all">All feeds</option>
          <!-- Populated by populateFeedDropdown() -->
        </select>
      </div>

      <!-- Detection type — static list matching YOLO classes -->
      <div class="filter-group">
        <label>Detection Type</label>
        <select class="input" id="filter-class"
          style="padding:7px 10px;font-size:12px">
          <option value="all">All types</option>
          <option value="phone">phone</option>
          <option value="cheatsheet">cheatsheet</option>
          <option value="cheating">cheating</option>
          <option value="looking_away">looking_away</option>
          <option value="person">person</option>
        </select>
      </div>

      <button class="btn btn-ghost" style="align-self:flex-end"
        onclick="loadIncidents()">
        ⟳ Apply
      </button>

    </div>

    <!-- Results table -->
    <div class="card" style="padding:0;overflow:hidden">
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Time</th>
            <th>Session</th>
            <th>Candidate</th>
            <th>Detection</th>
            <th>Confidence</th>
            <th>Severity</th>
          </tr>
        </thead>
        <tbody id="incident-table">
          <tr>
            <td colspan="7"
              style="color:var(--t3);text-align:center">
              Loading...
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </main>
</div>

<script src="/js/nav.js"></script>
<script>
  document.getElementById('sidebar').innerHTML = buildSidebar();
  initSidebar();

  // ── State ─────────────────────────────────────────────────
  let currentData     = [];   // current incident rows for CSV export
  let activeSessionId = null; // currently active session id
  let allSessions     = [];   // all sessions for dropdown

  // ── Bootstrap ─────────────────────────────────────────────
  async function init() {
    // Get active session so "Active session" option resolves correctly
    const active    = await api('/api/sessions/active');
    activeSessionId = active?.session?.id || null;

    // Load all sessions to populate the session dropdown
    const sessData = await api('/api/sessions');
    allSessions    = sessData?.sessions || [];

    populateSessionDropdown();

    // Load feeds for the default selected session, then load incidents
    await onSessionChange();
  }

  // ── Session dropdown ──────────────────────────────────────
  function populateSessionDropdown() {
    const sel = document.getElementById('filter-session');

    // Remove any previously added dynamic options
    // (keep "Active session" and "All sessions" at index 0 and 1)
    while (sel.options.length > 2) sel.remove(2);

    allSessions.forEach(s => {
      const opt   = document.createElement('option');
      opt.value   = s.id;
      opt.text    = s.name + (s.ended_at ? '' : ' ● active');
      // Pre-select the active session
      if (s.id === activeSessionId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // ── Called whenever session dropdown changes ──────────────
  // Repopulates the feed dropdown based on which session is selected,
  // using session_feeds attendance records for that session.
  // This mirrors the signal history date→session coupling logic.
  async function onSessionChange() {
    const sessionVal = document.getElementById('filter-session').value;

    // Resolve session value → actual session id
    let resolvedId = null;
    if (sessionVal === 'active') {
      resolvedId = activeSessionId;
    } else if (sessionVal !== 'all') {
      resolvedId = parseInt(sessionVal);
    }
    // 'all' → resolvedId stays null → show all feeds

    await populateFeedDropdown(resolvedId);

    // Auto-apply filter when session changes so results stay in sync
    loadIncidents();
  }

  // ── Feed dropdown — populated from session_feeds ──────────
  // When a specific session is selected: fetch attendance for that
  // session and list only those feeds.
  // When "All sessions" is selected: list all feeds that have ever
  // had a detection (derived from the incidents table itself).
  async function populateFeedDropdown(sessionId) {
    const sel  = document.getElementById('filter-feed');
    const hint = document.getElementById('feed-hint');

    // Remember current selection so we can try to restore it
    const previousValue = sel.value;

    // Reset to "All feeds" only
    sel.innerHTML = '<option value="all">All feeds</option>';

    if (sessionId) {
      // ── Session-specific feeds: use attendance table ───────
      // session_feeds has the exact seats that were present,
      // even if those feed rows are now soft-deleted.
      const data = await api(`/api/sessions/${sessionId}/attendance`);
      const rows = data?.attendance || [];

      if (rows.length > 0) {
        rows.forEach(row => {
          const opt   = document.createElement('option');
          opt.value   = row.feed_id;
          // Show candidate name if set, otherwise just seat label
          opt.text    = row.candidate_name
            ? `${row.feed_label} — ${row.candidate_name}`
            : row.feed_label;
          sel.appendChild(opt);
        });
        hint.textContent = `(${rows.length} seat${rows.length !== 1 ? 's' : ''} in this session)`;
      } else {
        // Session has no attendance records (pre-attendance-tracking sessions)
        // Fall back to feeds derived from detections for this session
        const inc = await api(`/api/incidents?sessionId=${sessionId}`);
        const feedMap = {};
        (inc?.incidents || []).forEach(i => {
          if (i.feed_id && !feedMap[i.feed_id]) {
            feedMap[i.feed_id] = i.feed_label || `Feed ${i.feed_id}`;
          }
        });
        Object.entries(feedMap).forEach(([id, label]) => {
          const opt = document.createElement('option');
          opt.value = id;
          opt.text  = label;
          sel.appendChild(opt);
        });
        hint.textContent = rows.length === 0
          ? '(no attendance records — showing from detections)'
          : '';
      }

    } else {
      // ── All sessions: derive feed list from all detections ─
      // We can't use the current feeds table because historical feeds
      // are soft-deleted. Derive from detections which always have
      // the feed_label via JOIN.
      const inc = await api('/api/incidents');
      const feedMap = {};
      (inc?.incidents || []).forEach(i => {
        if (i.feed_id && !feedMap[i.feed_id]) {
          feedMap[i.feed_id] = i.feed_label || `Feed ${i.feed_id}`;
        }
      });

      // Sort by label for readability
      Object.entries(feedMap)
        .sort(([, a], [, b]) => a.localeCompare(b))
        .forEach(([id, label]) => {
          const opt = document.createElement('option');
          opt.value = id;
          opt.text  = label;
          sel.appendChild(opt);
        });

      hint.textContent = '';
    }

    // Restore previous selection if that feed is still in the list
    const optionValues = [...sel.options].map(o => o.value);
    if (optionValues.includes(previousValue)) {
      sel.value = previousValue;
    }
    // else defaults to "All feeds"
  }

  // ── Load incidents from backend ───────────────────────────
  async function loadIncidents() {
    const sessionVal = document.getElementById('filter-session').value;
    const feedId     = document.getElementById('filter-feed').value;
    const classLabel = document.getElementById('filter-class').value;

    const params = new URLSearchParams();

    // Resolve session filter to actual id
    if (sessionVal === 'active') {
      if (activeSessionId) params.set('sessionId', activeSessionId);
    } else if (sessionVal !== 'all') {
      params.set('sessionId', sessionVal);
    }

    if (feedId     !== 'all') params.set('feedId',     feedId);
    if (classLabel !== 'all') params.set('classLabel', classLabel);

    const data = await api(`/api/incidents?${params}`);
    if (!data) return;

    currentData = data.incidents;
    renderTable(currentData);
  }

  // ── Render results table ──────────────────────────────────
  function renderTable(rows) {
    const tbody = document.getElementById('incident-table');

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7"
            style="color:var(--t3);text-align:center;padding:32px">
            No incidents found
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = rows.map((inc, i) => {
      const conf     = inc.confidence;
      const severity = conf >= 0.85 ? 'HIGH'
                     : conf >= 0.65 ? 'MODERATE' : 'LOW';
      const sevClass = conf >= 0.85 ? 'badge-alert'
                     : conf >= 0.65 ? 'badge-warn' : 'badge-live';
      const time     = new Date(inc.detected_at);
      const session  = inc.session_name || '—';

      return `<tr>
        <td style="color:var(--t3)">${i + 1}</td>
        <td style="color:var(--t2)">
          ${time.toLocaleTimeString()}
          <span style="color:var(--t3);font-size:10px;margin-left:4px">
            ${time.toLocaleDateString()}
          </span>
        </td>
        <td style="color:var(--accent);font-size:11px">${session}</td>
        <td style="font-weight:500">${inc.feed_label || '—'}</td>
        <td>
          <span style="padding:2px 8px;background:var(--rdim);
            color:var(--red);border-radius:2px;
            font-size:11px;letter-spacing:0.06em">
            ${inc.class_label}
          </span>
        </td>
        <td style="color:${conf >= 0.8 ? 'var(--red)' : 'var(--amber)'}">
          ${(conf * 100).toFixed(1)}%
        </td>
        <td><span class="badge ${sevClass}">${severity}</span></td>
      </tr>`;
    }).join('');
  }

  // ── CSV export ────────────────────────────────────────────
  function exportCSV() {
    if (!currentData.length) return;
    const headers = ['#','Time','Session','Candidate','Detection','Confidence'];
    const rows    = currentData.map((inc, i) => [
      i + 1,
      new Date(inc.detected_at).toISOString(),
      inc.session_name || '',
      inc.feed_label   || '',
      inc.class_label,
      (inc.confidence * 100).toFixed(2) + '%'
    ]);
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `incidents_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Start ─────────────────────────────────────────────────
  init();
</script>
</body>
</html>
```` 
### 7.1.15 public/login.html  
````html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proctor — Login</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
<div class="login-page">
  <div class="login-grid"></div>

  <div class="login-panel">
    <div class="login-logo">
      <div class="login-icon">◈</div>
      <div>
        <div class="login-title">PROCTOR</div>
        <div class="login-sub">Exam Monitoring System</div>
      </div>
    </div>

    <hr class="divider">

    <div class="login-heading">SECURE ACCESS</div>
    <div class="login-desc">Authorized personnel only</div>

    <div class="error-box" id="error-box" style="display:none">
      <span>⚠</span>
      <span id="error-msg"></span>
    </div>

    <div class="form-field">
      <label for="username">Username</label>
      <input class="input" id="username" type="text"
        placeholder="Enter username" autocomplete="username">
    </div>

    <div class="form-field">
      <label for="password">Password</label>
      <input class="input" id="password" type="password"
        placeholder="Enter password" autocomplete="current-password">
    </div>

    <button class="btn btn-primary submit-btn" id="login-btn" onclick="doLogin()">
      SIGN IN
    </button>

    <div class="login-footer">Demo credentials: admin / proctor123</div>
  </div>
</div>

<script>
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  async function doLogin() {
    const btn      = document.getElementById('login-btn');
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      showError('Please enter username and password');
      return;
    }

    btn.textContent = 'AUTHENTICATING...';
    btn.disabled    = true;

    const res  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (res.ok) {
      window.location.href = data.redirect;
    } else {
      showError(data.error || 'Login failed');
      btn.textContent = 'SIGN IN';
      btn.disabled    = false;
    }
  }

  function showError(msg) {
    document.getElementById('error-msg').textContent  = msg;
    document.getElementById('error-box').style.display = 'flex';
  }
</script>
</body>
</html>

```` 
### 7.1.16 public/session.html  
````html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proctor — Session</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    /* Editable candidate name field in attendance table */
    .attendance-name-input {
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--border);
      color: var(--t1);
      font-family: var(--fm);
      font-size: 12px;
      padding: 2px 4px;
      width: 160px;
      outline: none;
      transition: border-color 0.15s;
    }
    .attendance-name-input:focus        { border-color: var(--accent); }
    .attendance-name-input::placeholder { color: var(--t3); }
  </style>
</head>
<body>
<div class="layout">
  <div id="sidebar" style="min-width:200px;width:200px;flex-shrink:0"></div>

  <main class="main">

    <div class="page-header">
      <div>
        <div class="page-title">Session Overview</div>
        <div class="page-sub" id="session-sub">Loading...</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:10px;color:var(--t3);letter-spacing:0.06em">
          Auto-refreshes every 10s
        </span>
        <a href="/allsessions" class="btn btn-ghost" style="font-size:11px;padding:5px 12px">
          ☰ All Sessions
        </a>
      </div>
    </div>

    <!-- Active / historical session banner -->
    <div class="session-banner" id="session-banner" style="display:none">
      <div class="session-dot" id="session-dot"></div>
      <div>
        <div class="session-name" id="banner-name">—</div>
        <div class="session-meta" id="banner-meta">—</div>
      </div>
      <div style="flex:1"></div>
      <!-- Only visible when session is still active -->
      <button class="btn btn-danger" id="end-btn"
        style="font-size:11px;padding:5px 12px;display:none"
        onclick="endSession()">
        ⏹ End Session
      </button>
    </div>

    <!-- Shown when no session is active and none specified via URL -->
    <div id="no-session-warning" style="
      display:none;padding:16px;background:var(--rdim);
      border:1px solid rgba(255,59,59,0.25);border-radius:8px;
      font-size:12px;color:var(--red);margin-bottom:16px">
      ⚠ No active session.
      <a href="/allsessions" style="color:var(--accent);margin-left:8px">
        Start a new session →
      </a>
    </div>

    <!-- KPI row -->
    <div class="kpi-row">
      <div class="card kpi-card">
        <div class="kpi-val" style="color:var(--green)" id="kpi-live">—</div>
        <div class="kpi-lbl">Live Feeds</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-val" style="color:var(--red)" id="kpi-alerts">—</div>
        <div class="kpi-lbl">Total Alerts</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-val" style="color:var(--amber)" id="kpi-flagged">—</div>
        <div class="kpi-lbl">Flagged</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-val" style="color:var(--accent)" id="kpi-clear">—</div>
        <div class="kpi-lbl">Clear</div>
      </div>
    </div>

    <!-- Charts row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="card">
        <div class="card-title">Alerts Per Candidate</div>
        <div id="bar-chart" style="display:flex;flex-direction:column;gap:10px">
          <div style="color:var(--t3);font-size:12px">Loading...</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Detection Types</div>
        <div id="class-chart" style="display:flex;flex-direction:column;gap:10px">
          <div style="color:var(--t3);font-size:12px">Loading...</div>
        </div>
      </div>
    </div>

    <!-- Candidate summary table -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-title">Candidate Summary</div>
      <table class="table">
        <thead>
          <tr>
            <th>Seat</th>
            <th>Status</th>
            <th>Alert Count</th>
            <th>Risk Level</th>
          </tr>
        </thead>
        <tbody id="candidate-table">
          <tr><td colspan="4" style="color:var(--t3);text-align:center">Loading...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Attendance register — sourced from session_feeds table -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div class="card-title" style="margin-bottom:0">Attendance Register</div>
        <span id="attendance-count"
          style="font-size:11px;color:var(--t3);font-family:var(--fm)"></span>
      </div>
      <p style="font-size:11px;color:var(--t3);margin-bottom:12px">
        Populated when cameras connect during a session.
        Click a name field to add or edit. Press Enter or click away to save.
      </p>
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Seat</th>
            <th>Candidate Name</th>
            <th>Connected At</th>
            <th>Alerts</th>
          </tr>
        </thead>
        <tbody id="attendance-tbody">
          <tr>
            <td colspan="5" style="color:var(--t3);text-align:center">Loading...</td>
          </tr>
        </tbody>
      </table>
    </div>

  </main>
</div>

<script src="/js/nav.js"></script>
<script>
  document.getElementById('sidebar').innerHTML = buildSidebar();
  initSidebar();

  // ── State ─────────────────────────────────────────────────
  // urlSessionId: set once from URL param — null means "use active"
  // currentSessionId: updated by API response, tracks what's displayed
  const urlParams      = new URLSearchParams(window.location.search);
  const urlSessionId   = urlParams.get('id') ? parseInt(urlParams.get('id')) : null;
  let   currentSessionId = urlSessionId;
  let   isHistorical     = false;
  let   refreshTimer     = null;

  // ── Helpers: clear all tables immediately ─────────────────
  // Called before any async load to prevent stale data showing
  // while the new request is in flight.
  function clearAllSections() {
    document.getElementById('kpi-live').textContent    = '—';
    document.getElementById('kpi-alerts').textContent  = '—';
    document.getElementById('kpi-flagged').textContent = '—';
    document.getElementById('kpi-clear').textContent   = '—';
    document.getElementById('bar-chart').innerHTML =
      '<div style="color:var(--t3);font-size:12px">Loading...</div>';
    document.getElementById('class-chart').innerHTML =
      '<div style="color:var(--t3);font-size:12px">Loading...</div>';
    document.getElementById('candidate-table').innerHTML =
      '<tr><td colspan="4" style="color:var(--t3);text-align:center">Loading...</td></tr>';
    document.getElementById('attendance-tbody').innerHTML =
      '<tr><td colspan="5" style="color:var(--t3);text-align:center">Loading...</td></tr>';
    document.getElementById('attendance-count').textContent = '';
  }

  // ── Main data load ────────────────────────────────────────
  async function loadStats() {
    // Always query with the explicit session id if we have one —
    // this ensures switching sessions via URL param works correctly
    const url = currentSessionId
      ? `/api/stats?session_id=${currentSessionId}`
      : '/api/stats';

    const data = await api(url);
    if (!data) return;

    // ── Session banner ────────────────────────────────────────
    if (data.sessionInfo) {
      currentSessionId = data.sessionId;
      const s          = data.sessionInfo;
      isHistorical     = !!s.ended_at;

      document.getElementById('session-banner').style.display      = 'flex';
      document.getElementById('no-session-warning').style.display  = 'none';
      document.getElementById('banner-name').textContent            = s.name;

      // Green dot = active, grey dot = ended/historical
      const dot         = document.getElementById('session-dot');
      dot.style.background = isHistorical ? 'var(--t3)' : 'var(--green)';
      dot.style.boxShadow  = isHistorical ? 'none'      : '0 0 6px var(--green)';

      // End button only visible for active sessions
      document.getElementById('end-btn').style.display =
        isHistorical ? 'none' : 'inline-flex';

      const parts = [];
      if (s.course_name)     parts.push(s.course_name);
      if (s.instructor_name) parts.push(s.instructor_name);
      if (s.time_block)      parts.push(s.time_block);
      document.getElementById('banner-meta').textContent = parts.join(' · ');

      const started = new Date(s.created_at).toLocaleString();
      const status  = s.ended_at
        ? `Ended ${new Date(s.ended_at).toLocaleTimeString()}`
        : 'ACTIVE';
      document.getElementById('session-sub').textContent =
        `${started} · ${status}`;

    } else {
      // No session — clear everything and show warning
      currentSessionId = null;
      document.getElementById('session-banner').style.display     = 'none';
      document.getElementById('no-session-warning').style.display = 'block';
      document.getElementById('session-sub').textContent          = 'No active session';
      clearAllSections();
      return; // nothing else to render
    }

    // ── KPIs ──────────────────────────────────────────────────
    document.getElementById('kpi-live').textContent    = data.liveFeeds;
    document.getElementById('kpi-alerts').textContent  = data.totalAlerts;
    document.getElementById('kpi-flagged').textContent = data.flaggedFeeds;
    document.getElementById('kpi-clear').textContent   = data.clearFeeds ?? 0;

    // ── Alerts per candidate bar chart ────────────────────────
    const maxAlerts = Math.max(...data.byFeed.map(f => f.alerts), 1);
    document.getElementById('bar-chart').innerHTML = data.byFeed.length === 0
      ? '<div style="color:var(--t3);font-size:12px">No candidates this session</div>'
      : data.byFeed.map(f => `
          <div style="display:grid;grid-template-columns:80px 1fr 30px;
            align-items:center;gap:10px">
            <span style="font-size:11px;color:var(--t2)">${f.label}</span>
            <div style="height:6px;background:var(--raised);
              border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${(f.alerts / maxAlerts) * 100}%;
                background:var(--red);border-radius:3px;
                transition:width 0.4s ease"></div>
            </div>
            <span style="font-size:11px;text-align:right;
              color:${f.alerts > 0 ? 'var(--red)' : 'var(--t3)'}">
              ${f.alerts}
            </span>
          </div>`).join('');

    // ── Detection types bar chart ─────────────────────────────
    const classes  = Object.entries(data.byClass);
    const maxClass = Math.max(...classes.map(([, v]) => v), 1);
    document.getElementById('class-chart').innerHTML = classes.length === 0
      ? '<div style="color:var(--t3);font-size:12px">No detections yet</div>'
      : classes.map(([cls, count]) => `
          <div style="display:grid;grid-template-columns:90px 1fr 30px;
            align-items:center;gap:10px">
            <span style="font-size:11px;color:var(--t2)">${cls}</span>
            <div style="height:6px;background:var(--raised);
              border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${(count / maxClass) * 100}%;
                background:var(--amber);border-radius:3px;
                transition:width 0.4s ease"></div>
            </div>
            <span style="font-size:11px;color:var(--amber);text-align:right">
              ${count}
            </span>
          </div>`).join('');

    // ── Candidate summary table ───────────────────────────────
    document.getElementById('candidate-table').innerHTML =
      data.byFeed.length === 0
        ? `<tr>
             <td colspan="4"
               style="color:var(--t3);text-align:center;padding:24px">
               No candidates this session
             </td>
           </tr>`
        : data.byFeed.map(f => {
            const risk      = f.alerts === 0 ? 'CLEAR'
                            : f.alerts  <  4 ? 'MODERATE' : 'HIGH';
            const riskClass = f.alerts === 0 ? 'badge-live'
                            : f.alerts  <  4 ? 'badge-warn' : 'badge-alert';
            return `<tr>
              <td>
                <a href="/candidate/${f.id || ''}"
                  style="font-weight:500;color:var(--t1);text-decoration:none">
                  ${f.label}
                </a>
              </td>
              <td>
                <span class="badge ${f.connected ? 'badge-live' : 'badge-off'}">
                  ● ${f.connected ? 'LIVE' : 'OFFLINE'}
                </span>
              </td>
              <td style="color:${f.alerts > 0 ? 'var(--red)' : 'var(--t2)'}">
                ${f.alerts}
              </td>
              <td><span class="badge ${riskClass}">${risk}</span></td>
            </tr>`;
          }).join('');

    // ── Attendance register ───────────────────────────────────
    // Separate API call — session_feeds table
    if (currentSessionId) {
      loadAttendance(currentSessionId);
    } else {
      // No session — clear attendance table
      document.getElementById('attendance-tbody').innerHTML =
        `<tr>
           <td colspan="5"
             style="color:var(--t3);text-align:center;padding:24px">
             No session selected
           </td>
         </tr>`;
      document.getElementById('attendance-count').textContent = '';
    }
  }

  // ── Attendance table ──────────────────────────────────────
  async function loadAttendance(sessionId) {
    const data = await api(`/api/sessions/${sessionId}/attendance`);
    if (!data) return;

    const rows    = data.attendance;
    const tbody   = document.getElementById('attendance-tbody');
    const countEl = document.getElementById('attendance-count');

    countEl.textContent =
      `${rows.length} seat${rows.length !== 1 ? 's' : ''} registered`;

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5"
            style="color:var(--t3);text-align:center;padding:24px">
            No cameras connected during this session
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = rows.map((row, i) => {
      const alerts     = Number(row.alert_count);
      const alertColor = alerts > 0 ? 'var(--amber)' : 'var(--t3)';
      const connAt     = new Date(row.connected_at).toLocaleTimeString();

      return `<tr>
        <td style="color:var(--t3)">${i + 1}</td>
        <td style="font-weight:500;font-family:var(--fd);font-size:14px">
          ${row.feed_label}
        </td>
        <td>
          <input
            class="attendance-name-input"
            type="text"
            value="${row.candidate_name || ''}"
            placeholder="Enter name..."
            data-sfid="${row.id}"
            onblur="saveName(this)"
            onkeydown="if(event.key==='Enter') this.blur()">
        </td>
        <td style="font-size:11px;color:var(--t3)">${connAt}</td>
        <td style="color:${alertColor}">
          ${alerts > 0 ? `${alerts} flag${alerts > 1 ? 's' : ''}` : '—'}
        </td>
      </tr>`;
    }).join('');
  }

  // ── Save candidate name (inline edit) ────────────────────
  async function saveName(input) {
    const sfId = input.dataset.sfid;
    const name = input.value.trim();
    // PATCH endpoint updates session_feeds.candidate_name
    await fetch(`/api/sessions/${currentSessionId}/attendance/${sfId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ candidate_name: name || null })
    });
  }

  // ── End session ───────────────────────────────────────────
  async function endSession() {
    if (!currentSessionId) return;
    if (!confirm('End this session? Cameras will need to reconnect for the next one.')) return;

    // Clear all sections immediately before the API call completes
    // so the user sees empty tables rather than stale data
    clearAllSections();
    document.getElementById('session-banner').style.display = 'none';

    const res  = await fetch(`/api/sessions/${currentSessionId}/end`, { method: 'PUT' });
    const data = await res.json();

    if (res.ok) {
      currentSessionId = null;
      isHistorical     = false;
      loadStats(); // reload — will show "No active session" state
    } else {
      alert('Error: ' + data.error);
      loadStats(); // reload to restore correct state
    }
  }

  // ── Auto-refresh ──────────────────────────────────────────
  // Only auto-refresh for active sessions. Historical sessions
  // don't change so there's no point polling them.
  function startRefresh() {
    stopRefresh();
    refreshTimer = setInterval(() => {
      if (!isHistorical) loadStats();
    }, 10000);
  }

  function stopRefresh() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  }

  // ── Init ──────────────────────────────────────────────────
  // Clear sections before first load to avoid flash of loading state
  clearAllSections();
  loadStats();
  startRefresh();
</script>
</body>
</html>
```` 

### 7.1.17 public/students-list.html  
````html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proctor — Students</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    .student-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 10px;
      font-family: var(--fm);
      font-weight: 600;
      letter-spacing: 0.06em;
      border-radius: 3px;
      background: var(--adim);
      color: var(--accent);
      border: 1px solid rgba(0,212,255,0.2);
    }
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 16px 0;
    }
    .page-btn {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--t2);
      font-size: 12px;
      font-family: var(--fm);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.12s;
    }
    .page-btn:hover { border-color: var(--accent); color: var(--accent); }
    .page-btn.active {
      background: var(--adim);
      border-color: var(--accent);
      color: var(--accent);
    }
    .page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .search-wrap {
      position: relative;
    }
    .search-wrap input { padding-left: 34px; }
    .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 14px;
      color: var(--t3);
      pointer-events: none;
    }
  </style>
</head>
<body>
<div class="layout">
  <div id="sidebar" style="min-width:200px;width:200px;flex-shrink:0"></div>

  <main class="main">
    <div class="page-header">
      <div>
        <div class="page-title">Students</div>
        <div class="page-sub" id="student-count">Loading...</div>
      </div>
      <div style="font-size:11px;color:var(--t3)">
        Read-only — add students via PostgreSQL only
      </div>
    </div>

    <!-- Search + filter bar -->
    <div style="display:flex;gap:10px;margin-bottom:16px;align-items:center">

      <div class="search-wrap" style="flex:1">
        <span class="search-icon">⌕</span>
        <input class="input" id="search-input" type="text"
          placeholder="Search by name or student ID..."
          oninput="onSearch()">
      </div>

      <select class="input" id="section-filter"
        style="padding:8px 10px;font-size:12px;width:220px">
        <option value="">All sections</option>
      </select>

    </div>

    <!-- Students table -->
    <div class="card" style="padding:0;overflow:hidden">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Student ID</th>
            <th>Course / Section</th>
            <th>Seat</th>
            <th>Pen Unit</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody id="students-tbody">
          <tr>
            <td colspan="6"
              style="color:var(--t3);text-align:center;padding:32px">
              Loading...
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="pagination" id="pagination"></div>

  </main>
</div>

<script src="/js/nav.js"></script>
<script>
  document.getElementById('sidebar').innerHTML = buildSidebar();
  initSidebar();

  // ── State ─────────────────────────────────────────────
  let currentPage  = 1;
  let totalPages   = 1;
  let searchQuery  = '';
  let sectionFilter = '';
  let searchTimer  = null;

  // ── Bootstrap ─────────────────────────────────────────
  async function init() {
    await loadSectionFilter();
    loadStudents();
  }

  // ── Populate section filter dropdown ──────────────────
  async function loadSectionFilter() {
    const data = await api('/api/sessions'); // reuse sessions to get section names
    // Actually fetch sections directly from students unique sections
    // (we don't have a /api/sections endpoint yet — derive from student data)
    const allRes = await fetch('/api/students?limit=50', { credentials: 'include' });
    const all    = await allRes.json();
    const seen   = new Map();

    (all.students || []).forEach(s => {
      if (s.course_code && s.section_name) {
        const key   = `${s.course_code}/${s.section_name}`;
        const label = `${s.course_code}/${s.section_name} — ${s.instructor_initials || ''}`;
        if (!seen.has(key)) seen.set(key, label);
      }
    });

    const sel = document.getElementById('section-filter');
    [...seen.entries()].sort().forEach(([key, label]) => {
      const opt = document.createElement('option');
      opt.value = key;  // "CSE299/06"
      opt.text  = label;
      sel.appendChild(opt);
    });
  }

  // ── Search with 350ms debounce ────────────────────────
  function onSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentPage   = 1;
      searchQuery   = document.getElementById('search-input').value.trim();
      sectionFilter = document.getElementById('section-filter').value;
      loadStudents();
    }, 350);
  }

  document.getElementById('section-filter')
    .addEventListener('change', onSearch);

  // ── Fetch and render students ─────────────────────────
  async function loadStudents() {
    const params = new URLSearchParams({
      page:  currentPage,
      limit: 20,
      q:     searchQuery,
    });

    const res  = await fetch(`/api/students?${params}`, { credentials: 'include' });
    const data = await res.json();

    const students = data.students   || [];
    const pag      = data.pagination || { total: 0, pages: 1 };

    totalPages = pag.pages || 1;
    document.getElementById('student-count').textContent =
      `${pag.total} student${pag.total !== 1 ? 's' : ''} found`;

    renderTable(students);
    renderPagination(pag);
  }

  // ── Render table rows ─────────────────────────────────
  function renderTable(students) {
    const tbody = document.getElementById('students-tbody');

    if (students.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6"
            style="color:var(--t3);text-align:center;padding:32px">
            No students found
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = students.map(s => {
      const section = s.course_code && s.section_name
        ? `<span class="student-badge">${s.course_code}/${s.section_name}</span>`
        : '<span style="color:var(--t3)">—</span>';

      return `<tr>
        <td style="font-weight:600">${s.name}</td>
        <td style="font-family:var(--fm);font-size:12px;color:var(--accent)">
          ${s.student_id}
        </td>
        <td>${section}</td>
        <td style="color:var(--t2)">${s.seat_number || '—'}</td>
        <td style="color:var(--t2);font-family:var(--fm)">
          ${s.pen_unit_id ? `Unit #${s.pen_unit_id}` : '—'}
        </td>
        <td style="font-size:11px;color:var(--t3)">${s.email || '—'}</td>
      </tr>`;
    }).join('');
  }

  // ── Pagination controls ───────────────────────────────
  function renderPagination(pag) {
    const wrap = document.getElementById('pagination');
    if (pag.pages <= 1) { wrap.innerHTML = ''; return; }

    let html = `
      <button class="page-btn"
        onclick="goPage(${currentPage - 1})"
        ${currentPage <= 1 ? 'disabled' : ''}>
        ‹
      </button>`;

    // Show max 7 page buttons with ellipsis
    const maxButtons = 7;
    let start = Math.max(1, currentPage - 3);
    let end   = Math.min(pag.pages, start + maxButtons - 1);
    if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);

    if (start > 1) {
      html += `<button class="page-btn" onclick="goPage(1)">1</button>`;
      if (start > 2) html += `<span style="color:var(--t3);padding:0 4px">…</span>`;
    }

    for (let p = start; p <= end; p++) {
      html += `<button class="page-btn ${p === currentPage ? 'active' : ''}"
        onclick="goPage(${p})">${p}</button>`;
    }

    if (end < pag.pages) {
      if (end < pag.pages - 1) html += `<span style="color:var(--t3);padding:0 4px">…</span>`;
      html += `<button class="page-btn" onclick="goPage(${pag.pages})">${pag.pages}</button>`;
    }

    html += `
      <button class="page-btn"
        onclick="goPage(${currentPage + 1})"
        ${currentPage >= pag.pages ? 'disabled' : ''}>
        ›
      </button>`;

    wrap.innerHTML = html;
  }

  function goPage(p) {
    if (p < 1 || p > totalPages) return;
    currentPage = p;
    loadStudents();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Init ──────────────────────────────────────────────
  init();
</script>
</body>
</html>
```` 

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


