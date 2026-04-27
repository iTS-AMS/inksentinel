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
import cameraLinksRouter  from './routes/camera-links.js'; 
import settingsRouter      from './routes/settings.js';
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
app.use('/api/camera-links', cameraLinksRouter)
 app.use('/api/settings', settingsRouter)
 
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