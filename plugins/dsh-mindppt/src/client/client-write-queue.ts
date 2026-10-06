const writes = new Map<string, Promise<void>>()
const selections = new Map<string, Promise<void>>()

export function trackClientWrite(
  sessionId: string,
  write: Promise<unknown>,
): void {
  const settled = write.then(() => {}, () => {})
  writes.set(sessionId, settled)
  void settled.then(() => {
    if (writes.get(sessionId) === settled) writes.delete(sessionId)
  })
}

export async function waitForClientWrites(sessionId: string): Promise<void> {
  await (writes.get(sessionId) ?? Promise.resolve())
}

export function queueClientSelection(
  sessionId: string,
  writeBarrier: Promise<void>,
  operation: () => Promise<unknown>,
): Promise<void> {
  const previous = selections.get(sessionId) ?? Promise.resolve()
  const run = previous.then(async () => {
    await writeBarrier
    await operation()
  })
  const settled = run.then(() => {}, () => {})
  selections.set(sessionId, settled)
  void settled.then(() => {
    if (selections.get(sessionId) === settled) selections.delete(sessionId)
  })
  return run
}
