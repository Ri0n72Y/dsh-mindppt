import { useEffect, useState } from 'react'
import { parseSessionFileAddress } from '../shared.ts'
import { readWholeSource, relatedReader, type WorkspaceFilesRemote } from './dsh.ts'
import { InteractiveWorkbench, type WorkbenchSession } from './InteractiveWorkbench.tsx'
import { BrowserMindPptRuntime } from './runtime.ts'

export function PreviewPage({ resourceAddress, remote }: {
  resourceAddress: string
  remote: WorkspaceFilesRemote
}) {
  const file = parseSessionFileAddress(resourceAddress)
  const [session, setSession] = useState<WorkbenchSession>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!file) return
    const controller = new AbortController()
    const identity = { sessionId: file.sessionId, path: file.path }
    void (async () => {
      try {
        const read = await readWholeSource(remote, file.sessionId, file.path, controller.signal)
        const runtime = await BrowserMindPptRuntime.create(
          read.source,
          relatedReader(remote, file.sessionId, file.path),
        )
        if (!controller.signal.aborted) {
          setSession({ identity, runtime })
          setError(undefined)
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(message(cause))
      }
    })()
    return () => controller.abort()
  }, [resourceAddress])

  if (!file) return <PreviewError text="Invalid MindPPT workspace address" />
  if (error && !session) return <PreviewError text={error} />
  if (!session) return <PreviewError text="Loading MindPPT workbench…" />
  return (
    <InteractiveWorkbench
      key={session.identity.sessionId + ':' + session.identity.path}
      session={session}
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
