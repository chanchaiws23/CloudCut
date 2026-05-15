import { useEffect, useState } from 'react';
import { commandManager, Command } from '../../state/commands/CommandManager';
import { RotateCcw, RotateCw, History } from 'lucide-react';

export function UndoHistoryPanel() {
  const [history, setHistory] = useState<Command[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    const update = () => {
      setHistory(commandManager.getHistory());
      setCanUndo(commandManager.canUndo());
      setCanRedo(commandManager.canRedo());
    };
    update();
    const unsubscribe = commandManager.subscribe(update);
    return unsubscribe;
  }, []);

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <History className="w-4 h-4" />
          <span>History</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => commandManager.undo()}
            disabled={!canUndo}
            className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => commandManager.redo()}
            disabled={!canRedo}
            className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {history.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">No actions yet</div>
        ) : (
          history.map((cmd, idx) => (
            <div
              key={cmd.id}
              className="text-xs px-2 py-1.5 rounded bg-accent/50 text-foreground truncate cursor-pointer hover:bg-accent"
              title={cmd.description}
              onClick={() => commandManager.undoTo(idx)}
            >
              <span className="text-muted-foreground mr-1">{idx + 1}.</span>
              {cmd.description}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
