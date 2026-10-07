import { useEffect, useRef, useState } from 'react'
import { parseSessionFileAddress } from '../shared.ts'
import { queueClientSelection, waitForClientWrites } from './client-write-queue.ts'
import { readWholeSource, relatedReader, type WorkspaceFilesRemote } from './dsh.ts'
import { InteractiveWorkbench, type WorkbenchSession } from './InteractiveWorkbench.tsx'
import { BrowserMindPptRuntime } from './runtime.ts'
import { postDocument } from './wire.ts'

export function PreviewPage({ resourceAddress, remote }: {
  resourceAddress: string
  remote: WorkspaceFilesRemote
}) {
  const file = parseSessionFileAddress(resourceAddress)
  const [session, setSession] = useState<WorkbenchSession>()
  const [error, setError] = useState<string>()
  const selectionId = useRef('mindppt-preview:' + crypto.randomUUID())

  useEffect(() => {
    if (!file) return
    const controller = new AbortController()
    const identity = { sessionId: file.sessionId, path: file.path }
    const selected = queueClientSelection(
      file.sessionId,
      waitForClientWrites(file.sessionId),
      () => postDocument({ action: 'select', identity, selectionId: selectionId.current }),
    )
    void (async () => {
      try {
        await selected
        const read = await readWholeSource(remote, file.sessionId, file.path, controller.signal)
        const runtime = await BrowserMindPptRuntime.create(
          read.source,
          relatedReader(remote, file.sessionId, file.path),
        )
        if (!controller.signal.aborted) {
          setSession({ identity, runtime, version: read.version })
          setError(undefined)
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(message(cause))
      }
    })()
    return () => {
      controller.abort()
      const barrier = waitForClientWrites(file.sessionId)
      void queueClientSelection(
        file.sessionId,
        barrier,
        () => postDocument({
          action: 'clear',
          sessionId: file.sessionId,
          path: file.path,
          selectionId: selectionId.current,
        }),
      ).catch(() => {})
    }
  }, [resourceAddress])

  if (!file) return <PreviewError text="Invalid MindPPT workspace address" />
  if (error && !session) return <PreviewError text={error} />
  if (!session) return <PreviewError text="Loading MindPPT workbench…" />
  return (
    <InteractiveWorkbench
      key={session.identity.sessionId + ':' + session.identity.path}
      session={session}
      remote={remote}
    />
  )
}

function PreviewError({ text }: { text: string }) {
  return <main style={errorRootStyle}><p>{text}</p></main>
}
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
const errorRootStyle = {
  position: 'fixed', inset: 0, zIndex: 2147483647,
  display: 'grid', placeItems: 'center', margin: 0, background: '#fff',
} as const
