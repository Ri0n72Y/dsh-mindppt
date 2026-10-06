export class SessionWriteQueue {
  private readonly tails = new Map<string, Promise<void>>()

  pending(sessionId: string): Promise<void> | undefined {
    return this.tails.get(sessionId)
  }

  async run<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(sessionId) ?? Promise.resolve()
    let release = () => {}
    const done = new Promise<void>(resolve => { release = resolve })
    const tail = previous.then(() => done)
    this.tails.set(sessionId, tail)
    await previous
    try {
      return await operation()
    } finally {
      release()
      if (this.tails.get(sessionId) === tail) this.tails.delete(sessionId)
    }
  }
}
