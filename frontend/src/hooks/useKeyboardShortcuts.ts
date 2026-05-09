import { useEffect } from 'react';
import { useUIStore } from '../state/uiStore';
import { useProjectStore } from '../state/projectStore';
import { usePlaybackStore } from '../state/playbackStore';
import { commandManager } from '../state/commands/CommandManager';

export function useKeyboardShortcuts() {
  const { selectedClipIds, deselectAll, setActiveTool } = useUIStore();
  const { deleteClips, splitClip, clips } = useProjectStore();
  const { togglePlay, seek, currentTimeMs } = usePlaybackStore();

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

      if (e.key === 'v' || e.key === 'V') setActiveTool('select');
      if (e.key === 'b' || e.key === 'B') setActiveTool('blade');
      if (e.key === 'h' || e.key === 'H') setActiveTool('hand');

      if (e.key === 'Home') seek(0);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipIds, currentTimeMs, deleteClips, splitClip, togglePlay, seek, deselectAll, setActiveTool]);
}
