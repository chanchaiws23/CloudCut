export interface Command {
  id: string;
  type: string;
  description: string;
  timestamp: number;
  execute(): void;
  undo(): void;
}

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory = 50;
  private listeners: Array<() => void> = [];

  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.notify();
  }

  undo(): void {
    const command = this.undoStack.pop();
    if (!command) return;
    command.undo();
    this.redoStack.push(command);
    this.notify();
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (!command) return;
    command.execute();
    this.undoStack.push(command);
    this.notify();
  }

  getHistory(): Command[] {
    return [...this.undoStack];
  }

  undoTo(index: number): void {
    const target = Math.max(0, Math.min(index, this.undoStack.length - 1));
    while (this.undoStack.length - 1 > target) {
      this.undo();
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getLastDescription(): string {
    return this.undoStack[this.undoStack.length - 1]?.description || '';
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const commandManager = new CommandManager();
