import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Clip, ClipEffect } from '../../types';
import { useProjectStore } from '../../state/projectStore';
import { api } from '../../services/api';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';

interface EffectEditorProps {
  clip: Clip;
  effects: ClipEffect[];
  projectId: string;
}

const EFFECT_TYPES = ['brightness', 'contrast', 'saturation', 'blur'];

export function EffectEditor({ clip, effects, projectId }: EffectEditorProps) {
  const { addEffect, removeEffect, updateEffect, loadProject } = useProjectStore();
  const [adding, setAdding] = useState(false);

  const handleAdd = async (type: string) => {
    setAdding(false);
    const params = { value: type === 'blur' ? 0 : type === 'opacity' ? 1 : 0 };
    const newEffect = await api.timeline
      .addEffect(projectId, clip.id, { type, params, enabled: true })
      .catch((error) => {
        console.error(error);
        return null;
      });
    if (newEffect) addEffect(clip.id, newEffect);
  };

  const handleToggle = (effect: ClipEffect) => {
    updateEffect(clip.id, effect.id, { params: effect.params, enabled: !effect.enabled });
  };

  const handleDelete = (effectId: string) => {
    removeEffect(clip.id, effectId);
  };

  const handleReverseOrder = async () => {
    const effectIds = [...effects].reverse().map((effect) => effect.id);
    await api.timeline.reorderEffects(projectId, clip.id, effectIds).catch(console.error);
    await loadProject(projectId);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-foreground">Effects</h4>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAdding(!adding)}
            className="h-7 w-7 text-muted-foreground"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
          {adding && (
            <div className="absolute right-0 top-6 z-50 bg-card border border-border rounded shadow-lg py-1 min-w-[130px]">
              {EFFECT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => handleAdd(type)}
                  className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-accent capitalize"
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {effects.length === 0 && (
        <p className="text-xs text-muted-foreground">No effects. Click + to add.</p>
      )}
      {effects.length > 1 && (
        <Button variant="secondary" size="sm" onClick={handleReverseOrder} className="w-full">
          Reverse effect order
        </Button>
      )}

      <div className="space-y-2">
        {effects.map((effect) => (
          <div key={effect.id} className="space-y-1.5 bg-muted/30 rounded p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground capitalize">{effect.type}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggle(effect)}
                  className={`w-8 h-4 rounded-full transition-colors ${effect.enabled ? 'bg-blue-500' : 'bg-muted'}`}
                >
                  <div className={`w-3 h-3 rounded-full bg-white mx-0.5 transition-transform ${effect.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(effect.id)}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
            {effect.enabled && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-8">Val</span>
                <Slider
                  min={effect.type === 'blur' ? 0 : effect.type === 'saturation' || effect.type === 'contrast' ? 0 : -100}
                  max={effect.type === 'blur' ? 20 : effect.type === 'saturation' || effect.type === 'contrast' ? 3 : 100}
                  step={effect.type === 'blur' ? 0.5 : 0.01}
                  value={[Number(effect.params.value ?? 0)]}
                  onValueChange={([value]) => updateEffect(clip.id, effect.id, { value })}
                  className="flex-1"
                />
                <span className="text-[10px] text-muted-foreground w-10 text-right">
                  {Number(effect.params.value ?? 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
