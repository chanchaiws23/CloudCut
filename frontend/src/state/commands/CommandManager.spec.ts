import { describe, it, expect, vi } from 'vitest';
import { CommandManager, type Command } from './CommandManager';

function createMockCommand(type: string, description: string): Command {
  return {
    id: crypto.randomUUID(),
    type,
    description,
    timestamp: Date.now(),
    execute: vi.fn(),
    undo: vi.fn(),
  };
}

describe('CommandManager', () => {
  it('executes a command and adds it to history', () => {
    const manager = new CommandManager();
    const cmd = createMockCommand('move', 'Move clip');

    manager.execute(cmd);

    expect(cmd.execute).toHaveBeenCalledOnce();
    expect(manager.canUndo()).toBe(true);
    expect(manager.getHistory()).toHaveLength(1);
  });

  it('undo reverts the last command', () => {
    const manager = new CommandManager();
    const cmd = createMockCommand('move', 'Move clip');

    manager.execute(cmd);
    manager.undo();

    expect(cmd.undo).toHaveBeenCalledOnce();
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(true);
  });

  it('redo re-applies undone command', () => {
    const manager = new CommandManager();
    const cmd = createMockCommand('move', 'Move clip');

    manager.execute(cmd);
    manager.undo();
    manager.redo();

    expect(cmd.execute).toHaveBeenCalledTimes(2);
    expect(cmd.undo).toHaveBeenCalledOnce();
    expect(manager.canUndo()).toBe(true);
  });

  it('clears redo stack on new execute', () => {
    const manager = new CommandManager();
    const cmd1 = createMockCommand('move', 'Move clip');
    const cmd2 = createMockCommand('trim', 'Trim clip');

    manager.execute(cmd1);
    manager.undo();
    manager.execute(cmd2);

    expect(manager.canRedo()).toBe(false);
    expect(manager.getHistory()).toHaveLength(1);
    expect(manager.getLastDescription()).toBe('Trim clip');
  });

  it('notifies subscribers on state change', () => {
    const manager = new CommandManager();
    const listener = vi.fn();
    manager.subscribe(listener);

    const cmd = createMockCommand('move', 'Move clip');
    manager.execute(cmd);

    expect(listener).toHaveBeenCalled();
  });

  it('limits history to 50 commands', () => {
    const manager = new CommandManager();

    for (let i = 0; i < 55; i++) {
      manager.execute(createMockCommand('move', `Move ${i}`));
    }

    expect(manager.getHistory()).toHaveLength(50);
  });

  it('getLastDescription returns empty string when no history', () => {
    const manager = new CommandManager();
    expect(manager.getLastDescription()).toBe('');
  });
});
