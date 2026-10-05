import { useSyncExternalStore } from 'react'
import type { RefCallback, RefObject } from 'react'
import type { MindPptFileIdentity } from '../shared.ts'
import { MindPptCanvas } from './Canvas.tsx'
import { BrowserMindPptRuntime } from './runtime.ts'
import { postDocument } from './wire.ts'

interface AuthoringSurfaceProps {
  runtime: BrowserMindPptRuntime
  identity: MindPptFileIdentity | undefined
  error: string | undefined
  editor: RefObject<HTMLTextAreaElement | null>
  writeTail: RefObject<Promise<string>>
  reload(): void
  resourceAddress: string
  scrollportRef: RefCallback<HTMLElement>
  onError(error: string | undefined): void
}

export function AuthoringSurface({
  runtime,
  identity,
  error,
  editor,
  writeTail,
  reload,
  resourceAddress,
  scrollportRef,
  onError,
}: AuthoringSurfaceProps) {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  )
  const save = (source: string) => {
    runtime.setSource(source)
    if (!identity) return
    const write = writeTail.current.then(expectedVersion => {
      if (!expectedVersion) {
        throw new Error('MindPPT workspace version unavailable')
      }
      return postDocument({
        action: 'write',
        identity,
        source,
        expectedVersion,
      })
    })
    writeTail.current = write
    void write.then(
      () => onError(undefined),
      cause => {
        onError(cause instanceof Error ? cause.message : String(cause))
        reload()
      },
    )
  }
  const preview = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('mindppt-preview', resourceAddress)
    window.open(url, '_blank', 'noopener')
  }
  return (
    <section
      ref={scrollportRef}
      style={rootStyle}
      aria-label="MindPPT authoring panel"
    >
      <header style={headerStyle}>
        <strong>MindPPT</strong>
        <span>{snapshot.structureCurrent ? 'Current' : 'Last-good preview'}</span>
        <button type="button" disabled={!identity} onClick={preview}>Preview</button>
      </header>
      <textarea
        ref={editor}
        aria-label="MindPPT source editor"
        spellCheck={false}
        value={snapshot.source}
        onChange={event => save(event.target.value)}
        style={editorStyle}
      />
      {error && <div role="alert" style={errorStyle}>{error}</div>}
      <div aria-live="polite" style={{ display: 'grid', gap: 4 }}>
        {snapshot.diagnostics.map((diagnostic, index) => (
          <button
            key={index}
            type="button"
            style={{ textAlign: 'left' }}
            onClick={() => {
              editor.current?.focus()
              if (diagnostic.sourceRange) {
                editor.current?.setSelectionRange(
                  diagnostic.sourceRange.start,
                  diagnostic.sourceRange.end,
                )
              }
            }}
          >
            {diagnostic.severity}: {diagnostic.message}
          </button>
        ))}
      </div>
      <div style={{ minHeight: 320, height: '45vh' }}>
        <MindPptCanvas
          elements={snapshot.elements}
          files={snapshot.files}
          onFontMetricsReady={() => runtime.refreshElements()}
        />
      </div>
    </section>
  )
}

const rootStyle = {
  display: 'grid',
  gap: 8,
  padding: 8,
  height: '100%',
  boxSizing: 'border-box',
} as const
const headerStyle = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  justifyContent: 'space-between',
} as const
const editorStyle = {
  width: '100%',
  minHeight: 180,
  resize: 'vertical',
  fontFamily: 'monospace',
  boxSizing: 'border-box',
} as const
const errorStyle = { padding: 8, background: '#fff4f4' } as const
