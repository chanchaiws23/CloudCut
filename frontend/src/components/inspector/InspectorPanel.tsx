import { useUIStore } from '../../state/uiStore';
import { useProjectStore } from '../../state/projectStore';
import { ClipInfo } from './ClipInfo';
import { TransformEditor } from './TransformEditor';
import { EffectEditor } from './EffectEditor';

interface InspectorPanelProps {
  projectId: string;
}

export function InspectorPanel({ projectId }: InspectorPanelProps) {
  const { selectedClipIds } = useUIStore();
  const { clips, effects } = useProjectStore();

  const selectedClip = selectedClipIds.length === 1
    ? clips.find((c) => c.id === selectedClipIds[0])
    : null;

  if (!selectedClip) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-xs text-muted-foreground text-center">
          {selectedClipIds.length > 1
            ? `${selectedClipIds.length} clips selected`
            : 'Select a clip to inspect'}
        </p>
      </div>
    );
  }

  const clipEffects = effects[selectedClip.id] || [];

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inspector</h3>
      <ClipInfo clip={selectedClip} />
      <div className="h-px bg-border" />
      <TransformEditor clip={selectedClip} projectId={projectId} />
      <div className="h-px bg-border" />
      <EffectEditor clip={selectedClip} effects={clipEffects} projectId={projectId} />
    </div>
  );
}
