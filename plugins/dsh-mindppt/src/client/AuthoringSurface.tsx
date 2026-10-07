import { useSyncExternalStore } from 'react'
import type { RefCallback, RefObject } from 'react'
import type { MindPptFileIdentity } from '../shared.ts'
import { MindPptPanorama } from './Canvas.tsx'
import { queueDocumentSourceWrite } from './document-write.ts'
import { SourceEditor } from './SourceEditor.tsx'
import type { BrowserMindPptRuntime } from './runtime.ts'
import type { DocumentView } from './view-state.ts'

interface Cell<T> { current: T }

interface AuthoringSurfaceProps {
  runtime: BrowserMindPptRuntime
  identity: MindPptFileIdentity | undefined
  error: string | undefined
  editor: RefObject<HTMLTextAreaElement | null>
  writeTail: Cell<Promise<string>>
  selectionTail: Cell<Promise<void>>
  pendingWrites: Cell<number>
  editRevision: Cell<number>
  reload(): void
  onSaved(version: string): void
  scrollportRef: RefCallback<HTMLElement>
  onError(error: string | undefined): void
  view: DocumentView
}

export function AuthoringSurface({
  runtime, identity, error, editor, writeTail, selectionTail,
  pendingWrites, editRevision, reload, onSaved, scrollportRef, onError, view,
}: AuthoringSurfaceProps) {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  )
  const save = (source: string) => {
    runtime.setSource(source)
    if (!identity) return
    editRevision.current += 1
    pendingWrites.current += 1
    const write = queueDocumentSourceWrite({
      identity,
      source,
      writeTail,
      selection: selectionTail.current,
    })
    void write.then(
      version => {
        pendingWrites.current -= 1
        onSaved(version)
        onError(undefined)
      },
      cause => {
        pendingWrites.current -= 1
        onError(cause instanceof Error ? cause.message : String(cause))
        reload()
      },
    )
  }

  if (view === 'panorama') {
    return (
      <section
        ref={scrollportRef}
        style={panoramaRootStyle}
        aria-label="MindPPT panorama panel"
      >
        <MindPptPanorama
          elements={snapshot.elements}
          files={snapshot.files}
          onFontMetricsReady={runtime.refreshElements}
        />
      </section>
    )
  }

  return (
    <section
      ref={scrollportRef}
      style={codeRootStyle}
      aria-label="MindPPT authoring panel"
    >
      <SourceEditor
        source={snapshot.source}
        diagnostics={snapshot.diagnostics}
        error={error}
        editor={editor}
        onChange={save}
      />
    </section>
  )
}

const codeRootStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 8,
  height: '100%',
  minHeight: 0,
  boxSizing: 'border-box',
} as const

const panoramaRootStyle = {
  height: '100%',
  minHeight: 0,
} as const
