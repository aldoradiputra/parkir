import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';

interface ConnectedClient {
  ws: WebSocket;
  type: 'dashboard' | 'edge';
  tenantId?: string;
  locationId?: string;
  laneId?: string;
  lastPing: number;
}

const clients = new Map<string, ConnectedClient>();
let wss: WebSocketServer;

/**
 * Initialize the WebSocket server.
 */
export function initWebSocketServer(server: HttpServer): void {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const clientType = url.searchParams.get('type') as 'dashboard' | 'edge' ?? 'dashboard';
    const tenantId = url.searchParams.get('tenantId') ?? undefined;
    const locationId = url.searchParams.get('locationId') ?? undefined;
    const laneId = url.searchParams.get('laneId') ?? undefined;
    const clientId = `${clientType}-${tenantId ?? 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const client: ConnectedClient = {
      ws,
      type: clientType,
      tenantId,
      locationId,
      laneId,
      lastPing: Date.now(),
    };

    clients.set(clientId, client);
    console.log(`[WS] Client connected: ${clientId} (${clientType})`);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(clientId, client, message);
      } catch (err) {
        console.error('[WS] Invalid message:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`[WS] Client disconnected: ${clientId}`);
    });

    ws.on('pong', () => {
      client.lastPing = Date.now();
    });

    // Send connection acknowledgment
    ws.send(JSON.stringify({ event: 'connected', clientId }));
  });

  // Ping interval to detect stale connections
  const pingInterval = setInterval(() => {
    const now = Date.now();
    clients.forEach((client, id) => {
      if (now - client.lastPing > 60000) {
        console.log(`[WS] Terminating stale client: ${id}`);
        client.ws.terminate();
        clients.delete(id);
        return;
      }
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      }
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  console.log('[WS] WebSocket server initialized');
}

/**
 * Handle incoming WebSocket messages.
 */
function handleMessage(clientId: string, client: ConnectedClient, message: any): void {
  const { event, data } = message;

  switch (event) {
    case 'ping':
      client.lastPing = Date.now();
      sendToClient(clientId, { event: 'pong' });
      break;

    case 'gate_status':
    case 'session_update':
    case 'payment_update':
    case 'alert':
      // Forward edge events to matching dashboard clients
      broadcastToDashboards(client.locationId, { event, data, source: clientId });
      break;

    default:
      console.log(`[WS] Unknown event from ${clientId}: ${event}`);
  }
}

/**
 * Send a message to a specific client by ID.
 */
function sendToClient(clientId: string, message: object): void {
  const client = clients.get(clientId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

/**
 * Broadcast a message to all dashboard clients for a given location.
 */
export function broadcastToDashboards(locationId: string | undefined, message: object): void {
  if (!locationId) return;

  clients.forEach((client) => {
    if (
      client.type === 'dashboard' &&
      client.locationId === locationId &&
      client.ws.readyState === WebSocket.OPEN
    ) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

/**
 * Send a command to a specific edge node (lane).
 */
export function sendToLane(laneId: string, message: object): boolean {
  let sent = false;
  clients.forEach((client) => {
    if (
      client.type === 'edge' &&
      client.laneId === laneId &&
      client.ws.readyState === WebSocket.OPEN
    ) {
      client.ws.send(JSON.stringify(message));
      sent = true;
    }
  });
  return sent;
}

/**
 * Broadcast to all edge nodes for a given location.
 */
export function broadcastToEdges(locationId: string, message: object): void {
  clients.forEach((client) => {
    if (
      client.type === 'edge' &&
      client.locationId === locationId &&
      client.ws.readyState === WebSocket.OPEN
    ) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

/**
 * Get connected client counts by type and location.
 */
export function getConnectionStats(): {
  total: number;
  dashboards: number;
  edges: number;
  byLocation: Record<string, { dashboards: number; edges: number }>;
} {
  let dashboards = 0;
  let edges = 0;
  const byLocation: Record<string, { dashboards: number; edges: number }> = {};

  clients.forEach((client) => {
    if (client.type === 'dashboard') dashboards++;
    else edges++;

    if (client.locationId) {
      if (!byLocation[client.locationId]) {
        byLocation[client.locationId] = { dashboards: 0, edges: 0 };
      }
      byLocation[client.locationId][client.type === 'dashboard' ? 'dashboards' : 'edges']++;
    }
  });

  return { total: clients.size, dashboards, edges, byLocation };
}
