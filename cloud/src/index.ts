import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

import { initWebSocketServer } from './services/websocket';
import authRoutes from './routes/auth';
import syncRoutes from './routes/sync';
import configRoutes from './routes/config';
import paymentRoutes from './routes/payment';
import gateRoutes from './routes/gate';
import nfcRoutes from './routes/nfc';
import sessionRoutes from './routes/sessions';
import revenueRoutes from './routes/revenue';
import memberRoutes from './routes/members';
import plateRuleRoutes from './routes/plate-rules';
import locationRoutes from './routes/locations';
import dashboardRoutes from './routes/dashboard';
import alertRoutes from './routes/alerts';
import settingsRoutes from './routes/settings';
import deviceRoutes from './routes/devices';

// --- Globals ---
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    if (times > 10) return null;
    return Math.min(times * 200, 2000);
  },
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

// --- App ---
const app = express();
const server = http.createServer(app);

// --- Middleware ---
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Health check ---
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/config', configRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/gate', gateRoutes);
app.use('/api/nfc', nfcRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/plate-rules', plateRuleRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/devices', deviceRoutes);

// --- 404 ---
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// --- Global error handler ---
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.stack ?? err.message);

  const status = (err as any).statusCode ?? 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

  res.status(status).json({ error: message });
});

// --- WebSocket ---
initWebSocketServer(server);

// --- Start ---
const PORT = parseInt(process.env.PORT ?? '3000', 10);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Parkir Cloud] Server running on port ${PORT}`);
  console.log(`[Parkir Cloud] Environment: ${process.env.NODE_ENV ?? 'development'}`);
});

// --- Graceful shutdown ---
const shutdown = async () => {
  console.log('[Parkir Cloud] Shutting down...');
  server.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
