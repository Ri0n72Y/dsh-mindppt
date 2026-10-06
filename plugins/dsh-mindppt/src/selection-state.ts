export interface PendingSelection {
  generation: number
  path: string
  selectionId: string
  clear: boolean
}

export class SelectionTracker {
  private readonly generations = new Map<string, number>()
  private readonly pending = new Map<string, PendingSelection>()

  generation(sessionId: string): number {
    return this.generations.get(sessionId) ?? 0
  }

  get(sessionId: string): PendingSelection | undefined {
    return this.pending.get(sessionId)
  }

  has(sessionId: string): boolean {
    return this.pending.has(sessionId)
  }

  begin(
    sessionId: string,
    path: string,
    selectionId: string,
    clear: boolean,
  ): number {
    const generation = this.generation(sessionId) + 1
    this.generations.set(sessionId, generation)
    this.pending.set(sessionId, {
      generation,
      path,
      selectionId,
      clear,
    })
    return generation
  }

  isCurrentSelect(
    sessionId: string,
    generation: number,
    path: string,
    selectionId: string,
  ): boolean {
    const pending = this.pending.get(sessionId)
    return this.generation(sessionId) === generation
      && pending?.generation === generation
      && !pending.clear
      && pending.path === path
      && pending.selectionId === selectionId
  }

  finish(sessionId: string, generation: number): void {
    if (this.pending.get(sessionId)?.generation === generation) {
      this.pending.delete(sessionId)
    }
  }
}
