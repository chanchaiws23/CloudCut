import { useCallback } from 'react';
import type { Clip } from '../../types';
import { useProjectStore } from '../../state/projectStore';
import { api } from '../../services/api';
import { commandManager } from '../../state/commands/CommandManager';
import { v4 as uuidv4 } from 'uuid';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';

interface TransformEditorProps {
  clip: Clip;
  projectId: string;
}

const fields = [
  { key: 'x', label: 'X', min: -100, max: 100, step: 0.1 },
  { key: 'y', label: 'Y', min: -100, max: 100, step: 0.1 },
  { key: 'scale', label: 'Scale', min: 0.1, max: 5, step: 0.01 },
  { key: 'rotation', label: 'Rotation', min: -360, max: 360, step: 1 },
  { key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.01 },
] as const;

export function TransformEditor({ clip, projectId }: TransformEditorProps) {
  const { applyRemoteClipUpdate } = useProjectStore();

  const handleChange = useCallback((key: string, value: number) => {
    const previousTransform = { ...clip.transform };
    const newTransform = { ...clip.transform, [key]: value };
    commandManager.execute({
      id: uuidv4(),
      type: 'clip.transform',
      description: `Change ${key}`,
      timestamp: Date.now(),
      execute: () => {
        applyRemoteClipUpdate(clip.id, { transform: newTransform });
        api.timeline.updateClip(projectId, clip.id, { transform: newTransform }).catch(console.error);
      },
      undo: () => {
        applyRemoteClipUpdate(clip.id, { transform: previousTransform });
        api.timeline.updateClip(projectId, clip.id, { transform: previousTransform }).catch(console.error);
      },
    });
  }, [clip, projectId, applyRemoteClipUpdate]);

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-foreground">Transform</h4>
      <div className="space-y-1.5">
        {fields.map(({ key, label, min, max, step }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-14">{label}</span>
            <Slider
              min={min}
              max={max}
              step={step}
              value={[Number(clip.transform[key as keyof typeof clip.transform] ?? 0)]}
              onValueChange={([value]) => handleChange(key, value)}
              className="flex-1"
            />
            <Input
              type="number"
              min={min}
              max={max}
              step={step}
              value={Number(clip.transform[key as keyof typeof clip.transform] ?? 0).toFixed(2)}
              onChange={(e) => handleChange(key, parseFloat(e.target.value))}
              className="w-16 text-right"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
