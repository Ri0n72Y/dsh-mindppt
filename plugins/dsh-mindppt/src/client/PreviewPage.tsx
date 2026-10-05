import { useEffect, useState, useSyncExternalStore } from 'react'
import { parseSessionFileAddress } from '../shared.ts'
import { MindPptCanvas } from './Canvas.tsx'
import { PresentationControls } from './Controls.tsx'
import {
  readWholeSource,
  relatedReader,
  type WorkspaceFilesRemote,
} from './dsh.ts'
import { BrowserMindPptRuntime } from './runtime.ts'

export function PreviewPage({
  resourceAddress,
  remote,
}: {
  resourceAddress: string
  remote: WorkspaceFilesRemote
}) {
  const [runtime, setRuntime] = useState<BrowserMindPptRuntime>()
  const [error, setError] = useState<string>()
  const file = parseSessionFileAddress(resourceAddress)

  useEffect(() => {
    if (!file) return
    const controller = new AbortController()
    void (async () => {
      try {
        const read = await readWholeSource(
          remote,
          file.sessionId,
          file.path,
          controller.signal,
        )
        const next = await BrowserMindPptRuntime.create(
          read.source,
          relatedReader(remote, file.sessionId, file.path),
        )
        if (!controller.signal.aborted) setRuntime(next)
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      }
    })()
    return () => controller.abort()
  }, [resourceAddress])

  if (!file) return <PreviewError text="Invalid MindPPT workspace address" />
  if (error) return <PreviewError text={error} />
  if (!runtime) return <PreviewError text="Loading MindPPT presentation…" />
  return <Presentation runtime={runtime} />
}

function Presentation({ runtime }: { runtime: BrowserMindPptRuntime }) {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  )
  return (
    <main style={rootStyle} aria-label="MindPPT presentation">
      <PresentationControls runtime={runtime} snapshot={snapshot} />
      <div style={{ minHeight: 0, flex: 1 }}>
        <MindPptCanvas
          elements={snapshot.elements}
          files={snapshot.files}
          focusRequest={snapshot.camera.focusRequest}
          onFontMetricsReady={() => runtime.refreshElements()}
        />
      </div>
    </main>
  )
}

function PreviewError({ text }: { text: string }) {
  return (
    <main style={{ ...rootStyle, display: 'grid', placeItems: 'center' }}>
      <p>{text}</p>
    </main>
  )
}

const rootStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 2147483647,
  display: 'flex',
  flexDirection: 'column',
  margin: 0,
  background: '#fff',
} as const
