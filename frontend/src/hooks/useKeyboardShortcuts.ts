import { useEffect } from 'react';
import { useUIStore } from '../state/uiStore';
import { useProjectStore } from '../state/projectStore';
import { usePlaybackStore } from '../state/playbackStore';
import { commandManager } from '../state/commands/CommandManager';
import { api } from '../services/api';
import type { Clip } from '../types';

let clipClipboard: Clip[] = [];

export function useKeyboardShortcuts() {
  const { selectedClipIds, deselectAll, setActiveTool, setZoom, selectClips } = useUIStore();
  const { deleteClips, splitClip, clips, project, addClipUndoable } = useProjectStore();
  const { togglePlay, seek, currentTimeMs, durationMs } = usePlaybackStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipIds.length > 0) {
          e.preventDefault();
          deleteClips(selectedClipIds);
        }
      }

      if (e.key === 's' || e.key === 'S') {
        if (selectedClipIds.length === 1) {
          splitClip(selectedClipIds[0], currentTimeMs);
        }
      }

      if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        clipClipboard = clips.filter((clip) => selectedClipIds.includes(clip.id)).map((clip) => ({ ...clip }));
      }

      if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!project || clipClipboard.length === 0) return;
        const firstPosition = Math.min(...clipClipboard.map((clip) => clip.trackPositionMs));
        Promise.all(
          clipClipboard.map((clip) =>
            api.timeline.createClip(project.id, {
              trackId: clip.trackId,
              assetId: clip.assetId,
              trackPositionMs: currentTimeMs + (clip.trackPositionMs - firstPosition),
              inPointMs: clip.inPointMs,
              outPointMs: clip.outPointMs,
              transform: clip.transform,
            }),
          ),
        ).then((created) => {
          created.forEach(addClipUndoable);
          selectClips(created.map((clip) => clip.id));
        }).catch(console.error);
      }

      if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const container = document.querySelector('.timeline-scroll-container') as HTMLElement | null;
        const width = container?.clientWidth || 800;
        const totalMs = Math.max(durationMs, clips.reduce((max, clip) => Math.max(max, clip.trackPositionMs + clip.durationMs), 0), 10000);
        setZoom(Math.max(5, Math.min(500, width / (totalMs / 1000))));
      }

      if ((e.key === '=' || e.key === '+') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setZoom(useUIStore.getState().zoomLevel + 10);
      }

      if (e.key === '-' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setZoom(useUIStore.getState().zoomLevel - 10);
      }

      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          commandManager.redo();
        } else {
          commandManager.undo();
        }
      }

      if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commandManager.redo();
      }

      if (e.key === 'Escape') {
        deselectAll();
      }

      if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.metaKey) setActiveTool('select');
      if (e.key === 'b' || e.key === 'B') setActiveTool('blade');
      if (e.key === 'h' || e.key === 'H') setActiveTool('hand');

      if (e.key === 'Home') seek(0);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipIds, currentTimeMs, durationMs, deleteClips, splitClip, clips, project, addClipUndoable, selectClips, togglePlay, seek, deselectAll, setActiveTool, setZoom]);
}
