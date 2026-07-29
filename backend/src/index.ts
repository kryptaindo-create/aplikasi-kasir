import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './auth';
import syncRouter from './sync';
import adminRouter from './admin';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support base64 image uploads for Berita Acara

// --- ROUTE REGISTERING ---
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/sync', syncRouter);
app.use('/api/v1/admin', adminRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Create HTTP Server
const server = http.createServer(app);

// --- WEBSOCKET SERVER FOR REAL-TIME FRAUD ALERTS & SESSIONS ---
const wss = new WebSocketServer({ noServer: true });

// Store active WebSocket connections with details
const clients = new Map<WebSocket, { userId: string; role: string; branchId: string | null }>();

wss.on('connection', (ws: WebSocket, req) => {
  console.log('New WebSocket connection established.');

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'IDENTIFY') {
        // Register client details
        clients.set(ws, {
          userId: data.userId,
          role: data.role,
          branchId: data.branchId || null
        });
        ws.send(JSON.stringify({ type: 'IDENTIFIED', message: 'Identity registered successfully' }));
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket connection closed.');
  });
});

// Integrate WebSocket Upgrade handshakes with HTTP server
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Helper function to broadcast fraud alerts to all connected Master Admins
export const broadcastFraudAlert = (alertType: string, payload: any) => {
  const alertString = JSON.stringify({
    type: 'FRAUD_ALERT',
    alertType,
    payload,
    timestamp: new Date().toISOString()
  });

  clients.forEach((info, ws) => {
    if (info.role === 'MASTER_ADMIN' && ws.readyState === WebSocket.OPEN) {
      ws.send(alertString);
    }
  });
};

// Start Server
server.listen(port, '0.0.0.0', () => {
  console.log(`[POS Server] Running on http://0.0.0.0:${port}`);
});
