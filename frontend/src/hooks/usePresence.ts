import { useState, useEffect, useRef } from 'react';
import { getPusher, usePusherChannel } from './usePusher';
import { usePlaybackStore } from '../state/playbackStore';
import { useProjectStore } from '../state/projectStore';
import { useUIStore } from '../state/uiStore';

export interface PresenceUser {
  userId: string;
  name: string;
  avatar: string;
  color: string;
  currentTimeMs: number;
  activeTrackId?: string;
  activeClipId?: string;
  isSelf?: boolean;
}

const USER_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

interface PusherMember {
  id: string;
  info?: { name?: string; avatar?: string; color?: string };
}

interface PusherMembers {
  each: (callback: (member: PusherMember, idx: number) => void) => void;
  me?: PusherMember;
}

interface CursorMoveData {
  userId: string;
  currentTimeMs?: number;
  timeMs?: number;
  activeTrackId?: string;
  activeClipId?: string;
}

export function usePresence(projectId: string) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const { currentTimeMs } = usePlaybackStore();
  const { selectedClipIds } = useUIStore();
  const { clips } = useProjectStore();
  const lastSentRef = useRef(0);
  const selfUserIdRef = useRef<string | null>(null);
  const activeClipId = selectedClipIds[0];
  const activeTrackId = activeClipId ? clips.find((clip) => clip.id === activeClipId)?.trackId : undefined;

  usePusherChannel(`presence-project-${projectId}`, {
    'pusher:subscription_succeeded': (members: PusherMembers) => {
      const users: PresenceUser[] = [];
      selfUserIdRef.current = members.me?.id || selfUserIdRef.current;
      members.each((member: PusherMember, idx: number) => {
        const isSelf = member.id === selfUserIdRef.current;
        users.push({
          userId: member.id,
          name: member.info?.name || 'User',
          avatar: member.info?.avatar || '',
          color: member.info?.color || USER_COLORS[idx % USER_COLORS.length],
          currentTimeMs: 0,
          isSelf,
        });
      });
      setOnlineUsers(users);
    },
    'pusher:member_added': (member: PusherMember) => {
      setOnlineUsers((prev) => {
        const color = USER_COLORS[prev.length % USER_COLORS.length];
        return [...prev, {
          userId: member.id,
          name: member.info?.name || 'User',
          avatar: member.info?.avatar || '',
          color: member.info?.color || color,
          currentTimeMs: 0,
          isSelf: member.id === selfUserIdRef.current,
        }];
      });
    },
    'pusher:member_removed': (member: PusherMember) => {
      setOnlineUsers((prev) => prev.filter((u) => u.userId !== member.id));
    },
    'client-cursor-move': (data: CursorMoveData) => {
      const timeMs = data.currentTimeMs ?? data.timeMs ?? 0;
      setOnlineUsers((prev) =>
        prev.map((u) =>
          u.userId === data.userId
            ? {
                ...u,
                currentTimeMs: timeMs,
                activeTrackId: data.activeTrackId,
                activeClipId: data.activeClipId,
              }
            : u,
        ),
      );
    },
  });

  useEffect(() => {
    if (!projectId) return;
    const now = Date.now();
    if (now - lastSentRef.current < 100) return;
    lastSentRef.current = now;
    try {
      const channel = getPusher().channel(`presence-project-${projectId}`);
      const userId = (channel as unknown as { members?: { me?: { id: string } } })?.members?.me?.id;
      selfUserIdRef.current = userId || null;
      if (!userId) return;
      channel?.trigger('client-cursor-move', {
        userId,
        currentTimeMs,
        timeMs: currentTimeMs,
        activeTrackId,
        activeClipId,
      });
    } catch {
      // Pusher is optional in local demos.
    }
  }, [projectId, currentTimeMs, activeTrackId, activeClipId]);

  return { onlineUsers };
}
