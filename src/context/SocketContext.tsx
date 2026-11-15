import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getStoredToken } from '@/src/lib/api';
import { useAuth } from './AuthContext';

export interface LiveNotification {
  id: string;
  type:
    | 'team:member_joined'
    | 'team:member_left'
    | 'team:leader_changed'
    | 'team:deleted'
    | 'invitation:created'
    | 'invitation:accepted'
    | 'board:updated';
  title: string;
  description: string;
  teamId?: string;
  createdAt: string;
  read: boolean;
}

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  lastEventAt: string | null;
  notifications: LiveNotification[];
  unreadCount: number;
  markAllRead: () => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  lastEventAt: null,
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    const s = io({
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    s.on('connect', () => {
      setIsConnected(true);
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    const pushNotification = (
      type: LiveNotification['type'],
      title: string,
      description: string,
      teamId?: string,
    ) => {
      setNotifications((prev) => [
        {
          id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type,
          title,
          description,
          teamId,
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...prev.slice(0, 19),
      ]);
    };

    const invalidateTeamQueries = (payload?: { teamId?: string; hackathonId?: string }) => {
      setLastEventAt(new Date().toISOString());
      void queryClient.invalidateQueries({ queryKey: ['teams'] });
      void queryClient.invalidateQueries({ queryKey: ['hackathons'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      void queryClient.invalidateQueries({ queryKey: ['my-invitations-all'] });
      if (payload?.teamId) {
        void queryClient.invalidateQueries({ queryKey: ['team', payload.teamId] });
      }
      if (payload?.hackathonId) {
        void queryClient.invalidateQueries({ queryKey: ['hackathon', payload.hackathonId] });
      }
    };

    s.on('board:updated', (payload?: { teamId?: string; hackathonId?: string; action?: string }) => {
      invalidateTeamQueries(payload);
    });

    s.on('team:member_joined', (payload?: { teamId?: string; hackathonId?: string; userName?: string; team?: { name?: string } }) => {
      invalidateTeamQueries(payload);
      pushNotification(
        'team:member_joined',
        'Seat claimed',
        `${payload?.userName || 'A participant'} joined ${payload?.team?.name || 'a team'}.`,
        payload?.teamId,
      );
    });

    s.on('team:member_left', (payload?: { teamId?: string; hackathonId?: string; userName?: string; team?: { name?: string } }) => {
      invalidateTeamQueries(payload);
      pushNotification(
        'team:member_left',
        'Member departed',
        `${payload?.userName || 'A member'} left ${payload?.team?.name || 'a team'}.`,
        payload?.teamId,
      );
    });

    s.on('team:leader_changed', (payload?: { teamId?: string; hackathonId?: string; newLeaderName?: string }) => {
      invalidateTeamQueries(payload);
      pushNotification(
        'team:leader_changed',
        'Leadership transferred',
        `Leadership transferred deterministically to ${payload?.newLeaderName || 'next eligible member'}.`,
        payload?.teamId,
      );
    });

    s.on('team:updated', invalidateTeamQueries);

    s.on('team:deleted', (payload?: { teamId?: string; hackathonId?: string; teamName?: string }) => {
      invalidateTeamQueries(payload);
      pushNotification(
        'team:deleted',
        'Team dissolved',
        `${payload?.teamName || 'Team'} was cleanly archived after the last member departed.`,
      );
    });

    s.on('invitation:created', (payload?: { teamId?: string; hackathonId?: string }) => {
      invalidateTeamQueries(payload);
      pushNotification(
        'invitation:created',
        'Invitation generated',
        'A new SHA-256 secured team invitation was created.',
        payload?.teamId,
      );
    });

    s.on('invitation:accepted', (payload?: { teamId?: string; hackathonId?: string; userName?: string; team?: { name?: string } }) => {
      invalidateTeamQueries(payload);
      pushNotification(
        'invitation:accepted',
        'Invitation accepted',
        `${payload?.userName || 'A teammate'} accepted an invitation to ${payload?.team?.name || 'a team'}.`,
        payload?.teamId,
      );
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [user?.id, queryClient]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SocketContext.Provider
      value={{ socket, isConnected, lastEventAt, notifications, unreadCount, markAllRead }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
