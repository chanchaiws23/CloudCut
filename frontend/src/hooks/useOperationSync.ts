import { useEffect } from 'react';
import { usePusherChannel } from './usePusher';
import { useProjectStore } from '../state/projectStore';

export function useOperationSync(projectId: string) {
  const { applyRemoteClipUpdate, addClip, removeTrack } = useProjectStore();

  usePusherChannel(`private-project-${projectId}`, {
    'operation': (data: any) => {
      const { type, payload } = data;

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
    },
  });
}
