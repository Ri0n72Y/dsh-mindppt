import type { MindPptFileIdentity } from '../shared.ts'
import { trackClientWrite } from './client-write-queue.ts'
import { postDocument } from './wire.ts'

interface Cell<T> {
  current: T
}

export function queueDocumentSourceWrite({
  identity,
  source,
  writeTail,
  selection,
}: {
  identity: MindPptFileIdentity
  source: string
  writeTail: Cell<Promise<string>>
  selection?: Promise<unknown>
}): Promise<string> {
  const write = writeTail.current.then(async expectedVersion => {
    await (selection ?? Promise.resolve())
    if (!expectedVersion) {
      throw new Error('MindPPT workspace version unavailable')
    }
    return await postDocument({
      action: 'write',
      identity,
      source,
      expectedVersion,
    })
  })
  writeTail.current = write
  trackClientWrite(identity.sessionId, write)
  return write
}
