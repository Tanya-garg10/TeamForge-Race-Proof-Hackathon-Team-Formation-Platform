import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { verifyAccessToken, getUserById } from './auth.ts';

let ioInstance: SocketIOServer | null = null;

export interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    userName?: string;
  };
}

function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.slice(0, idx).trim();
      const val = decodeURIComponent(part.slice(idx + 1).trim());
      result[key] = val;
    }
  }
  return result;
}

export function initRealtime(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket: AuthenticatedSocket, next) => {
    const authToken = socket.handshake.auth?.token;
    const cookies = parseCookieHeader(socket.handshake.headers.cookie);
    const token = typeof authToken === 'string' && authToken ? authToken : cookies.tf_token;

    if (token) {
      try {
        const payload = verifyAccessToken(token);
        const user = getUserById(payload.sub);
        if (user) {
          socket.data.userId = user.id;
          socket.data.userName = user.name;
        }
      } catch {
        // Allow anonymous read-only connection to public board rooms, or reject if strict mode
        if (socket.handshake.auth?.requireAuth) {
          next(new Error('Unauthorized socket token'));
          return;
        }
      }
    }
    next();
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    socket.join('board');
    if (socket.data.userId) {
      socket.join(`user:${socket.data.userId}`);
    }

    socket.on('subscribe:hackathon', (hackathonId: string) => {
      if (typeof hackathonId === 'string' && hackathonId.length > 0 && hackathonId.length <= 128) {
        socket.join(`hackathon:${hackathonId}`);
      }
    });

    socket.on('unsubscribe:hackathon', (hackathonId: string) => {
      if (typeof hackathonId === 'string') {
        socket.leave(`hackathon:${hackathonId}`);
      }
    });

    socket.on('subscribe:team', (teamId: string) => {
      if (typeof teamId === 'string' && teamId.length > 0 && teamId.length <= 128) {
        socket.join(`team:${teamId}`);
      }
    });

    socket.on('unsubscribe:team', (teamId: string) => {
      if (typeof teamId === 'string') {
        socket.leave(`team:${teamId}`);
      }
    });
  });

  ioInstance = io;
  return io;
}

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export type RealtimeEventName =
  | 'team:member_joined'
  | 'team:member_left'
  | 'team:leader_changed'
  | 'team:updated'
  | 'team:deleted'
  | 'invitation:created'
  | 'invitation:accepted'
  | 'board:updated';

/**
 * Broadcasts real-time domain events strictly AFTER database commit.
 */
export function emitPostCommitEvent(
  event: RealtimeEventName,
  payload: Record<string, unknown>,
  rooms: string[] = ['board'],
): void {
  if (!ioInstance) return;
  const uniqueRooms = Array.from(new Set(rooms));
  for (const room of uniqueRooms) {
    ioInstance.to(room).emit(event, {
      ...payload,
      emittedAt: new Date().toISOString(),
    });
  }
}
