import { useState, useEffect } from 'react';
import { usePusherChannel } from './usePusher';
import { usePlaybackStore } from '../state/playbackStore';

interface PresenceUser {
  userId: string;
  name: string;
  avatar: string;
  color: string;
  currentTimeMs: number;
  activeTrackId?: string;
}

const USER_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

export function usePresence(projectId: string) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const { currentTimeMs } = usePlaybackStore();

  usePusherChannel(`presence-project-${projectId}`, {
    'pusher:subscription_succeeded': (members: any) => {
      const users: PresenceUser[] = [];
      members.each((member: any, idx: number) => {
        users.push({
          userId: member.id,
          name: member.info?.name || 'User',
          avatar: member.info?.avatar || '',
          color: USER_COLORS[idx % USER_COLORS.length],
          currentTimeMs: 0,
        });
      });
      setOnlineUsers(users);
    },
    'pusher:member_added': (member: any) => {
      setOnlineUsers((prev) => {
        const color = USER_COLORS[prev.length % USER_COLORS.length];
        return [...prev, {
          userId: member.id,
          name: member.info?.name || 'User',
          avatar: member.info?.avatar || '',
          color,
          currentTimeMs: 0,
        }];
      });
    },
    'pusher:member_removed': (member: any) => {
      setOnlineUsers((prev) => prev.filter((u) => u.userId !== member.id));
    },
    'client-cursor-move': (data: any) => {
      setOnlineUsers((prev) =>
        prev.map((u) => u.userId === data.userId ? { ...u, currentTimeMs: data.currentTimeMs } : u),
      );
    },
  });

  return { onlineUsers };
}
