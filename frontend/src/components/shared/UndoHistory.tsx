import { useState, useEffect } from 'react';
import { commandManager } from '../../state/commands/CommandManager';
import type { Command } from '../../state/commands/CommandManager';

export function UndoHistory() {
  const [history, setHistory] = useState<Command[]>([]);

  useEffect(() => {
    const unsub = commandManager.subscribe(() => {
      setHistory([...commandManager.getHistory()]);
    });
    return unsub;
  }, []);

  if (history.length === 0) return null;

  return (
    <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">History</h4>
      {[...history].reverse().map((cmd, i) => (
        <div
          key={cmd.id}
          className={`text-xs px-2 py-1 rounded cursor-pointer transition-colors ${
            i === 0 ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          }`}
          onClick={() => {
            const stepsToUndo = i + 1;
            for (let j = 0; j < stepsToUndo; j++) commandManager.undo();
          }}
        >
          {cmd.description}
        </div>
      ))}
    </div>
  );
}
