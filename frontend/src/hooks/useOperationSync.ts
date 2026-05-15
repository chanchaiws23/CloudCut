import { useEffect, useRef } from 'react';
import { usePusherChannel } from './usePusher';
import { useProjectStore } from '../state/projectStore';
import { api } from '../services/api';
import type { Clip, ClipEffect, Track } from '../types';

interface OperationPayload {
  clipId?: string;
  trackId?: string;
  changes?: Record<string, unknown>;
  [key: string]: unknown;
}

interface OperationEvent {
  type: string;
  payload: OperationPayload;
  userId?: string;
  seq?: number;
}

export function useOperationSync(projectId: string, currentUserId?: string) {
  const {
    applyRemoteClipUpdate,
    applyRemoteClipDelete,
    addClip,
    applyRemoteTrackAdd,
    applyRemoteTrackUpdate,
    applyRemoteTrackDelete,
    applyRemoteEffectAdd,
    applyRemoteEffectUpdate,
    applyRemoteEffectDelete,
  } = useProjectStore();
  const lastSeqRef = useRef<number>(0);
  const seenSeqRef = useRef<Set<number>>(new Set());

  const shouldSkipEvent = (userId?: string, seq?: number) => {
    if (userId && userId === currentUserId) return true;
    if (typeof seq === 'number') {
      if (seenSeqRef.current.has(seq)) return true;
      seenSeqRef.current.add(seq);
    }
    return false;
  };

  const applyOperation = (type: string, payload: OperationPayload) => {
    switch (type) {
      case 'clip.update':
        if (payload.clipId) applyRemoteClipUpdate(payload.clipId, payload.changes as Partial<Clip>);
        break;
      case 'clip.add':
        addClip(((payload.clip as Clip | undefined) || payload) as unknown as Clip);
        break;
      case 'clip.delete':
        if (payload.clipId) applyRemoteClipDelete(payload.clipId);
        break;
      case 'track.add':
        applyRemoteTrackAdd(((payload.track as Track | undefined) || payload) as unknown as Track);
        break;
      case 'track.update':
        if (payload.trackId) applyRemoteTrackUpdate(payload.trackId, payload.changes as Partial<Track>);
        break;
      case 'track.delete':
        if (payload.trackId) applyRemoteTrackDelete(payload.trackId);
        break;
      case 'effect.add':
        if (payload.clipId && payload.effect) applyRemoteEffectAdd(payload.clipId, payload.effect as ClipEffect);
        break;
      case 'effect.update':
        if (payload.clipId && payload.effectId) applyRemoteEffectUpdate(payload.clipId, payload.effectId as string, payload.changes || {});
        break;
      case 'effect.delete':
        if (payload.clipId && payload.effectId) applyRemoteEffectDelete(payload.clipId, payload.effectId as string);
        break;
      default:
        break;
    }
  };

  const syncMissedOperations = async (sinceSeq: number) => {
    try {
      const operations = await api.collaboration.getOperations(projectId, sinceSeq);
      if (operations && operations.length > 0) {
        for (const op of operations) {
          applyOperation(op.operationType, op.payload);
          if (op.clientSeq > lastSeqRef.current) {
            lastSeqRef.current = op.clientSeq;
          }
        }
      }
    } catch (err) {
      console.warn('Failed to sync missed operations:', err);
    }
  };

  usePusherChannel(`private-project-${projectId}`, {
    'pusher:subscription_succeeded': () => {
      if (lastSeqRef.current > 0) syncMissedOperations(lastSeqRef.current);
    },
    'operation': (data: OperationEvent) => {
      if (shouldSkipEvent(data.userId, data.seq)) return;
      const { type, payload, seq } = data;
      applyOperation(type, payload);
      if (typeof seq === 'number' && seq > lastSeqRef.current) {
        lastSeqRef.current = seq;
      }
    },
    'clip-added': (data: OperationPayload & { userId?: string; seq?: number }) => {
      if (shouldSkipEvent(data.userId, data.seq)) return;
      applyOperation('clip.add', data);
      if (typeof data.seq === 'number') lastSeqRef.current = Math.max(lastSeqRef.current, data.seq);
    },
    'clip-updated': (data: OperationPayload & { userId?: string; seq?: number }) => {
      if (shouldSkipEvent(data.userId, data.seq)) return;
      applyOperation('clip.update', data);
      if (typeof data.seq === 'number') lastSeqRef.current = Math.max(lastSeqRef.current, data.seq);
    },
    'clip-deleted': (data: OperationPayload & { userId?: string; seq?: number }) => {
      if (shouldSkipEvent(data.userId, data.seq)) return;
      applyOperation('clip.delete', data);
      if (typeof data.seq === 'number') lastSeqRef.current = Math.max(lastSeqRef.current, data.seq);
    },
    'track-added': (data: OperationPayload & { userId?: string; seq?: number }) => {
      if (shouldSkipEvent(data.userId, data.seq)) return;
      applyOperation('track.add', data);
      if (typeof data.seq === 'number') lastSeqRef.current = Math.max(lastSeqRef.current, data.seq);
    },
    'track-updated': (data: OperationPayload & { userId?: string; seq?: number }) => {
      if (shouldSkipEvent(data.userId, data.seq)) return;
      applyOperation('track.update', data);
      if (typeof data.seq === 'number') lastSeqRef.current = Math.max(lastSeqRef.current, data.seq);
    },
    'track-deleted': (data: OperationPayload & { userId?: string; seq?: number }) => {
      if (shouldSkipEvent(data.userId, data.seq)) return;
      applyOperation('track.delete', data);
      if (typeof data.seq === 'number') lastSeqRef.current = Math.max(lastSeqRef.current, data.seq);
    },
    'effect-added': (data: OperationPayload & { userId?: string; seq?: number }) => {
      if (shouldSkipEvent(data.userId, data.seq)) return;
      applyOperation('effect.add', data);
      if (typeof data.seq === 'number') lastSeqRef.current = Math.max(lastSeqRef.current, data.seq);
    },
    'effect-updated': (data: OperationPayload & { userId?: string; seq?: number }) => {
      if (shouldSkipEvent(data.userId, data.seq)) return;
      applyOperation('effect.update', data);
      if (typeof data.seq === 'number') lastSeqRef.current = Math.max(lastSeqRef.current, data.seq);
    },
    'effect-deleted': (data: OperationPayload & { userId?: string; seq?: number }) => {
      if (shouldSkipEvent(data.userId, data.seq)) return;
      applyOperation('effect.delete', data);
      if (typeof data.seq === 'number') lastSeqRef.current = Math.max(lastSeqRef.current, data.seq);
    },
  });

  useEffect(() => {
    lastSeqRef.current = 0;
    seenSeqRef.current.clear();
  }, [projectId]);
}
