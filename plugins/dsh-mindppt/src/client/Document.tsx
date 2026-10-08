import { useEffect, useState } from 'react'
import type { RefCallback } from 'react'
import type { MindPptFileIdentity } from '../shared.ts'
import { parseSessionFileAddress } from '../shared.ts'
import { AuthoringSurface } from './AuthoringSurface.tsx'
import { queueClientSelection, waitForClientWrites } from './client-write-queue.ts'
import { readWholeSource, relatedReader, type WorkspaceFilesRemote } from './dsh.ts'
import { BrowserMindPptRuntime } from './runtime.ts'
import { useDocumentView } from './view-state.ts'
import { postDocument } from './wire.ts'

interface RendererContent {
  kind: 'renderer'
  revision: number
  loaded(version: string): void
  failed(): void
  reload(): void
}
interface TabInfo { tab: { id: string; signal: AbortSignal } }
export interface SidebarRightFace { active(): { id: string } | undefined }
export interface MindPptDocumentProps {
  resourceAddress: string
  content: RendererContent | { kind: 'text' } | { kind: 'bytes' }
  addResource(address: string): void
  setResources(addresses: readonly string[]): void
  scrollportRef: RefCallback<HTMLElement>
  useTabInfo(): TabInfo
  remote: WorkspaceFilesRemote
  sidebarRight: SidebarRightFace
}
export function MindPptDocument(props: MindPptDocumentProps) {
  const {
    resourceAddress, content, addResource, setResources, scrollportRef,
    useTabInfo, remote, sidebarRight,
  } = props
  const { tab } = useTabInfo()
  const [view] = useDocumentView(tab.signal, resourceAddress)
  const file = parseSessionFileAddress(resourceAddress)
  const activeTabId = sidebarRight.active()?.id
  const [runtime, setRuntime] = useState<BrowserMindPptRuntime>()
  const [identity, setIdentity] = useState<MindPptFileIdentity>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (!file || content.kind !== 'renderer') return
    const controller = new AbortController()
    const sameFile = identity?.sessionId === file.sessionId
      && identity.path === file.path
    if (!sameFile) {
      setRuntime(undefined)
      setIdentity(undefined)
    }
    setResources([])
    void (async () => {
      try {
        const read = await readWholeSource(
          remote, file.sessionId, file.path, controller.signal,
        )
        if (controller.signal.aborted) return
        const nextIdentity = { sessionId: file.sessionId, path: file.path }
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
  useEffect(() => {
    if (!identity) return
    const pendingWrites = waitForClientWrites(identity.sessionId)
    const request = queueClientSelection(
      identity.sessionId,
      pendingWrites,
      () => activeTabId === tab.id
        ? postDocument({ action: 'select', identity, selectionId: tab.id })
        : postDocument({
            action: 'clear', sessionId: identity.sessionId,
            path: identity.path, selectionId: tab.id,
          }),
    )
    void request.catch(cause => {
      if (activeTabId === tab.id) setError(message(cause))
    })
  }, [activeTabId, identity?.sessionId, identity?.path, tab.id])
  useEffect(() => () => {
    if (!file) return
    const pendingWrites = waitForClientWrites(file.sessionId)
    void queueClientSelection(
      file.sessionId,
      pendingWrites,
      () => postDocument({
        action: 'clear', sessionId: file.sessionId,
        path: file.path, selectionId: tab.id,
      }),
    ).catch(() => {})
  }, [resourceAddress, tab.id])
  if (!file) return <p>MindPPT requires a DSH workspace file.</p>
  if (content.kind !== 'renderer') return <p>Loading MindPPT…</p>
  if (!runtime) return <p>{error ?? 'Loading MindPPT…'}</p>
  return (
    <AuthoringSurface
      runtime={runtime}
      error={error}
      scrollportRef={scrollportRef}
      view={view}
    />
  )
}
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
