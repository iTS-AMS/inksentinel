# InkSentinel — Backend

Centralized backend server for the InkSentinel exam proctoring system.
Handles camera feeds, AI detection results, ESP32 pen signals, authentication, and the invigilator dashboard API.


---

## Tech Stack

- **Runtime:** Node.js v20 LTS
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Auth:** JWT (jsonwebtoken) + bcryptjs
- **ESP32 Communication:** WebSocket (ws)

---

## Project Structure
backend/
├── src/
│   ├── index.js              ← entry point
│   ├── db.js                 ← PostgreSQL pool
│   ├── middleware/
│   │   └── auth.js           ← JWT auth middleware
│   ├── routes/
│   │   ├── auth.js           ← POST /api/auth/login, /logout
│   │   ├── feeds.js          ← GET /api/feeds, /api/feeds/:id
│   │   ├── incidents.js      ← GET /api/incidents
│   │   ├── stats.js          ← GET /api/stats
│   │   └── signals.js        ← POST /api/signal → ESP32
│   └── pages/
│       └── router.js         ← serves HTML pages
└── public/
├── css/style.css
├── js/nav.js
├── login.html
├── dashboard.html
├── candidate.html
├── session.html
└── incidents.html



---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create `.env` file in project root
```env
PORT=3000

# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=surveillance
PG_USER=postgres
PG_PASSWORD=your_postgres_password

# Auth
JWT_SECRET=any_long_random_string_minimum_32_chars
ADMIN_USERNAME=admin
# Generate hash: node -e "console.log(require('bcryptjs').hashSync('yourpassword',10))"
ADMIN_PASSWORD_HASH=paste_generated_hash_here

# ESP32 WebSocket
ESP32_URL=ws://192.168.1.1/ws
```

### 3. Set up PostgreSQL database

Create a database named `surveillance` in pgAdmin, then run the SQL in `database/schema.sql`.

### 4. Run the server
```bash
# development (auto-restarts on file change)
npm run dev

# production
npm start
```

Server runs at `http://localhost:3000`
Default login: `admin` / `proctor123`

---

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | No | Login, returns JWT cookie |
| POST | `/api/auth/logout` | No | Clears JWT cookie |
| GET | `/api/feeds` | Yes | All feeds with alert counts |
| GET | `/api/feeds/:id` | Yes | Single feed + detections |
| GET | `/api/incidents` | Yes | All incidents, filterable by feedId and classLabel |
| GET | `/api/stats` | Yes | Session KPIs and charts data |
| POST | `/api/signal` | Yes | Send command to ESP32 |

### Signal commands
```json
{ "cmd": "start" }
{ "cmd": "pause" }
{ "cmd": "end" }
{ "cmd": "reset" }
{ "cmd": "timer", "duration_ms": 5400000 }
{ "cmd": "warn",    "device_id": 1 }
{ "cmd": "enable",  "device_id": 1 }
{ "cmd": "disable", "device_id": 1, "punish_ms": 30000 }
{ "cmd": "deduct",  "device_id": 1, "time_ms": 60000 }
```

---

## Pages

| URL | Description |
|---|---|
| `/login` | Login page |
| `/dashboard` | Live feed grid |
| `/candidate/:id` | Single candidate + signal controls |
| `/session` | Session statistics |
| `/incidents` | Incident audit log |