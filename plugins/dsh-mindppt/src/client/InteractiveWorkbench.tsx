import { useRef, useState, useSyncExternalStore } from 'react'
import type { MindPptFileIdentity } from '../shared.ts'
import { MindPptCanvas } from './Canvas.tsx'
import { PresentationControls } from './Controls.tsx'
import { queueDocumentSourceWrite } from './document-write.ts'
import { readWholeSource, type WorkspaceFilesRemote } from './dsh.ts'
import type { BrowserMindPptRuntime } from './runtime.ts'
import { SourceEditor } from './SourceEditor.tsx'

export interface WorkbenchSession {
  identity: MindPptFileIdentity
  runtime: BrowserMindPptRuntime
  version: string
}

export function InteractiveWorkbench({ session, remote }: {
  session: WorkbenchSession
  remote: WorkspaceFilesRemote
}) {
  const { identity, runtime, version } = session
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  )
  const editor = useRef<HTMLTextAreaElement>(null)
  const writeTail = useRef<Promise<string>>(Promise.resolve(version))
  const [error, setError] = useState<string>()

  const reload = async () => {
    try {
      const read = await readWholeSource(remote, identity.sessionId, identity.path)
      runtime.setSource(read.source)
      writeTail.current = Promise.resolve(read.version)
    } catch (cause) {
      setError(message(cause))
    }
  }
  const save = (source: string) => {
    runtime.setSource(source)
    const write = queueDocumentSourceWrite({ identity, source, writeTail })
    void write.then(
      () => setError(undefined),
      cause => {
        setError(message(cause))
        void reload()
      },
    )
  }

  return (
    <main style={workbenchStyle} aria-label="MindPPT interactive workbench">
      <aside style={sourcePanelStyle}>
        <SourceEditor
          source={snapshot.source}
          diagnostics={snapshot.diagnostics}
          error={error}
          editor={editor}
          onChange={save}
        />
        <PresentationControls runtime={runtime} snapshot={snapshot} />
      </aside>
      <div style={{ minWidth: 0, minHeight: 0 }}>
        <MindPptCanvas
          elements={snapshot.elements}
          files={snapshot.files}
          focusRequest={snapshot.camera.focusRequest}
          onFontMetricsReady={runtime.refreshElements}
        />
      </div>
    </main>
  )
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
const workbenchStyle = {
  position: 'fixed', inset: 0, zIndex: 2147483647,
  display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)',
  margin: 0, background: '#fff',
} as const
const sourcePanelStyle = {
  display: 'flex', flexDirection: 'column', minHeight: 0,
  gap: 8, padding: 8, borderRight: '1px solid #ddd', overflow: 'auto',
} as const
