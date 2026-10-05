import { useEffect, useRef, useState } from 'react'
import type { RefCallback } from 'react'
import type { MindPptFileIdentity } from '../shared.ts'
import { parseSessionFileAddress } from '../shared.ts'
import { AuthoringSurface } from './AuthoringSurface.tsx'
import {
  readWholeSource,
  relatedReader,
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
  const writeTail = useRef<Promise<string>>(Promise.resolve(''))

  useEffect(() => {
    if (!file || content.kind !== 'renderer') return
    const controller = new AbortController()
    setResources([])
    void (async () => {
      try {
        const read = await readWholeSource(
          remote, file.sessionId, file.path, controller.signal,
        )
        const nextIdentity = {
          sessionId: file.sessionId,
          path: file.path,
        }
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
        writeTail.current = Promise.resolve(read.version)
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
      reload={content.reload}
      resourceAddress={resourceAddress}
      scrollportRef={scrollportRef}
      onError={setError}
    />
  )
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
