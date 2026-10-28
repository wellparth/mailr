import { Response } from 'express';
import { EventEmitter } from 'events';

class SyncBroadcaster extends EventEmitter {
  private clients: Map<string, Response[]> = new Map();

  addClient(userId: string, res: Response) {
    const existing = this.clients.get(userId) || [];
    existing.push(res);
    this.clients.set(userId, existing);

    res.on('close', () => {
      const current = this.clients.get(userId) || [];
      this.clients.set(
        userId,
        current.filter((client) => client !== res)
      );
    });
  }

  notifyUser(userId: string, event: string, data: Record<string, unknown>) {
    const userClients = this.clients.get(userId);
    if (!userClients || userClients.length === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    userClients.forEach((res) => {
      try {
        res.write(payload);
      } catch {
        // ignore closed connections
      }
    });
  }
}

export const syncBroadcaster = new SyncBroadcaster();
