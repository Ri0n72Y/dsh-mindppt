import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { RefCallback, RefObject } from 'react'
import type { MindPptFileIdentity } from '../shared.ts'
import { parseSessionFileAddress } from '../shared.ts'
import { MindPptCanvas } from './Canvas.tsx'
import {
  readWholeSource,
  relatedReader,
  resolveIdentity,
  type WorkspaceFilesRemote,
} from './dsh.ts'
import { BrowserMindPptRuntime } from './runtime.ts'
import { postDocument } from './wire.ts'
interface RendererContent {
  kind: 'renderer'
  revision: number
  loaded(version: string): void
  failed(): void
  reload(): void
}
export interface MindPptDocumentProps {
  resourceAddress: string
  content: RendererContent | { kind: 'text' } | { kind: 'bytes' }
  addResource(address: string): void
  setResources(addresses: readonly string[]): void
  scrollportRef: RefCallback<HTMLElement>
  remote: WorkspaceFilesRemote
}
export function MindPptDocument(props: MindPptDocumentProps) {
  const {
    resourceAddress,
    content,
    addResource,
    setResources,
    scrollportRef,
    remote,
  } = props
  const file = parseSessionFileAddress(resourceAddress)
  const [runtime, setRuntime] = useState<BrowserMindPptRuntime>()
  const [identity, setIdentity] = useState<MindPptFileIdentity>()
  const [error, setError] = useState<string>()
  const editor = useRef<HTMLTextAreaElement>(null)
  const writeTail = useRef(Promise.resolve())
  useEffect(() => {
    if (!file || content.kind !== 'renderer') return
    const controller = new AbortController()
    setResources([])
    void (async () => {
      try {
        const nextIdentity = await resolveIdentity(
          remote, file.sessionId, file.path, controller.signal,
        )
        const read = await readWholeSource(
          remote, file.sessionId, file.path, controller.signal,
        )
        if (controller.signal.aborted) return
        await postDocument({ action: 'select', identity: nextIdentity })
        const sameFile = identity?.sessionId === nextIdentity.sessionId
          && identity.path === nextIdentity.path
        let nextRuntime = sameFile ? runtime : undefined
        if (!nextRuntime) {
          nextRuntime = await BrowserMindPptRuntime.create(
            read.source,
            relatedReader(remote, file.sessionId, file.path, addResource),
          )
          if (controller.signal.aborted) return
          setRuntime(nextRuntime)
        } else {
          nextRuntime.setSource(read.source)
        }
        setIdentity(nextIdentity)
        setError(undefined)
        content.loaded(read.version)
      } catch (cause) {
        if (controller.signal.aborted) return
        setError(message(cause))
        content.failed()
      }
    })()
    return () => controller.abort()
  }, [resourceAddress, content.kind === 'renderer' ? content.revision : -1])
  useEffect(() => () => {
    if (!file) return
    void postDocument({
      action: 'clear',
      sessionId: file.sessionId,
      path: file.path,
    }).catch(() => {})
  }, [resourceAddress])
  if (!file) return <p>MindPPT requires a DSH workspace file.</p>
  if (content.kind !== 'renderer') return <p>Loading MindPPT…</p>
  if (!runtime) return <p>{error ?? 'Loading MindPPT…'}</p>
  return (
    <AuthoringSurface
      runtime={runtime}
      identity={identity}
      error={error}
      editor={editor}
      writeTail={writeTail}
      resourceAddress={resourceAddress}
      scrollportRef={scrollportRef}
      onError={setError}
    />
  )
}
function AuthoringSurface({
  runtime,
  identity,
  error,
  editor,
  writeTail,
  resourceAddress,
  scrollportRef,
  onError,
}: {
  runtime: BrowserMindPptRuntime
  identity: MindPptFileIdentity | undefined
  error: string | undefined
  editor: RefObject<HTMLTextAreaElement | null>
  writeTail: RefObject<Promise<void>>
  resourceAddress: string
  scrollportRef: RefCallback<HTMLElement>
  onError(error: string | undefined): void
}) {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  )
  const save = (source: string) => {
    runtime.setSource(source)
    if (!identity) return
    writeTail.current = writeTail.current
      .then(() => postDocument({ action: 'write', identity, source }))
      .then(() => onError(undefined))
      .catch(cause => { onError(message(cause)) })
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
const rootStyle = { display: 'grid', gap: 8, padding: 8, height: '100%', boxSizing: 'border-box' } as const
const headerStyle = { display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' } as const
const editorStyle = { width: '100%', minHeight: 180, resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box' } as const
const errorStyle = { padding: 8, background: '#fff4f4' } as const
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
