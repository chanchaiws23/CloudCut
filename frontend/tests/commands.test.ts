import { describe, it, expect, beforeEach } from 'vitest';
import { CommandManager } from '../src/state/commands/CommandManager';

describe('CommandManager', () => {
  let manager: CommandManager;
  let log: string[];

  beforeEach(() => {
    manager = new CommandManager();
    log = [];
  });

  const makeCmd = (id: string) => ({
    id,
    type: 'test',
    description: `Command ${id}`,
    timestamp: Date.now(),
    execute: () => log.push(`exec:${id}`),
    undo: () => log.push(`undo:${id}`),
  });

  it('executes a command', () => {
    manager.execute(makeCmd('A'));
    expect(log).toEqual(['exec:A']);
  });

  it('undoes a command', () => {
    manager.execute(makeCmd('A'));
    manager.undo();
    expect(log).toEqual(['exec:A', 'undo:A']);
  });

  it('redoes a command after undo', () => {
    manager.execute(makeCmd('A'));
    manager.undo();
    manager.redo();
    expect(log).toEqual(['exec:A', 'undo:A', 'exec:A']);
  });

  it('clears redo stack on new execute', () => {
    manager.execute(makeCmd('A'));
    manager.undo();
    manager.execute(makeCmd('B'));
    expect(manager.canRedo()).toBe(false);
    expect(log).toEqual(['exec:A', 'undo:A', 'exec:B']);
  });

  it('reports canUndo and canRedo correctly', () => {
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(false);
    manager.execute(makeCmd('A'));
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);
    manager.undo();
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(true);
  });

  it('notifies subscribers', () => {
    const notifications: number[] = [];
    let count = 0;
    manager.subscribe(() => notifications.push(++count));
    manager.execute(makeCmd('A'));
    manager.undo();
    manager.redo();
    expect(notifications).toEqual([1, 2, 3]);
  });

  it('limits history to maxHistory', () => {
    const mgr = new CommandManager();
    for (let i = 0; i < 55; i++) {
      mgr.execute(makeCmd(`cmd-${i}`));
    }
    expect(mgr.getHistory().length).toBe(50);
  });
});
