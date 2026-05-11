import { useEffect, useRef } from 'react';
import { usePusherChannel } from './usePusher';
import { useProjectStore } from '../state/projectStore';
import { api } from '../services/api';

export function useOperationSync(projectId: string) {
  const { applyRemoteClipUpdate, addClip, removeTrack } = useProjectStore();
  const lastSeqRef = useRef<number>(0);

  const applyOperation = (type: string, payload: any) => {
    switch (type) {
      case 'clip.update':
        applyRemoteClipUpdate(payload.clipId, payload.changes);
        break;
      case 'clip.add':
        addClip(payload);
        break;
      case 'clip.delete':
        useProjectStore.getState().deleteClips([payload.clipId]);
        break;
      case 'track.delete':
        removeTrack(payload.trackId);
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
      syncMissedOperations(lastSeqRef.current);
    },
    'operation': (data: any) => {
      const { type, payload, seq } = data;
      applyOperation(type, payload);
      if (typeof seq === 'number' && seq > lastSeqRef.current) {
        lastSeqRef.current = seq;
      }
    },
  });

  useEffect(() => {
    lastSeqRef.current = 0;
  }, [projectId]);
}
