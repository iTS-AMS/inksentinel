import dotenv from 'dotenv';

import express from 'express';
import pageRouter from './pages/router.js';
import { testConnection } from './db.js';
import feedRoutes from './routes/feeds.js';
import incidentRoutes from './routes/incidents.js'; 
import statsRoutes from './routes/stats.js';
import cookieParser from 'cookie-parser'; 
import authRoutes   from './routes/auth.js';         
import signalRoutes from './routes/signals.js';

import path from 'path';
import { fileURLToPath } from 'url';

const app  = express();
const PORT = process.env.PORT ||3000 ;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(cookieParser());

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/', pageRouter); 
app.use('/api/feeds', feedRoutes);
app.use('/api/incidents', incidentRoutes); 
app.use('/api/stats', statsRoutes);  
app.use('/api/auth', authRoutes); 
app.use('/api/signal', signalRoutes);

app.get('/', (req, res) => {
  res.send('Server is running');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

testConnection();