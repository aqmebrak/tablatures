export type Snapshot = { tex: string; label: string };

export class History {
  private entries: Snapshot[];
  private index = 0;
  private lastCoalesceKey: string | undefined;

  constructor(initial: Snapshot, private readonly depth = 100) {
    this.entries = [initial];
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.entries.length - 1;
  }

  push(snapshot: Snapshot, opts: { coalesceKey?: string } = {}): void {
    const { coalesceKey } = opts;
    // Drop any redo branch.
    this.entries.length = this.index + 1;

    if (coalesceKey && coalesceKey === this.lastCoalesceKey) {
      this.entries[this.index] = snapshot;
      return;
    }

    this.entries.push(snapshot);
    this.index++;
    this.lastCoalesceKey = coalesceKey;

    if (this.entries.length > this.depth + 1) {
      const overflow = this.entries.length - (this.depth + 1);
      this.entries.splice(0, overflow);
      this.index -= overflow;
    }
  }

  undo(): Snapshot | undefined {
    if (!this.canUndo) return undefined;
    this.index--;
    this.lastCoalesceKey = undefined;
    return this.entries[this.index];
  }

  redo(): Snapshot | undefined {
    if (!this.canRedo) return undefined;
    this.index++;
    this.lastCoalesceKey = undefined;
    return this.entries[this.index];
  }
}
