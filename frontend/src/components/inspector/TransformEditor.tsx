import { useCallback } from 'react';
import type { Clip } from '../../types';
import { useProjectStore } from '../../state/projectStore';
import { api } from '../../services/api';

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
    const newTransform = { ...clip.transform, [key]: value };
    applyRemoteClipUpdate(clip.id, { transform: newTransform });
    api.timeline.updateClip(projectId, clip.id, { transform: newTransform }).catch(console.error);
  }, [clip, projectId, applyRemoteClipUpdate]);

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-foreground">Transform</h4>
      <div className="space-y-1.5">
        {fields.map(({ key, label, min, max, step }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-14">{label}</span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={clip.transform[key as keyof typeof clip.transform] ?? 0}
              onChange={(e) => handleChange(key, parseFloat(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={Number(clip.transform[key as keyof typeof clip.transform] ?? 0).toFixed(2)}
              onChange={(e) => handleChange(key, parseFloat(e.target.value))}
              className="w-16 bg-input border border-border rounded px-1.5 py-0.5 text-xs text-foreground text-right focus:outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
