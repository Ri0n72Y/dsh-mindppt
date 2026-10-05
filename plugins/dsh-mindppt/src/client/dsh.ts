import type { MindPptFileIdentity } from '../shared.ts'
import type { RelatedAsset } from './runtime.ts'

export interface RemoteResult<T> {
  ok: boolean
  value?: T
  error?: { message: string; details?: Record<string, unknown> }
}

interface WorkspaceFileStat {
  absolutePath: string
  version: string
}

interface WorkspaceFileText extends WorkspaceFileStat {
  offset: number
  text: string
  lines: number
  eof: boolean
}

interface WorkspaceFileBytes extends WorkspaceFileStat {
  data: Uint8Array
  eof: boolean
}

export interface WorkspaceFilesRemote {
  stat(sessionId: string, path: string, signal?: AbortSignal): Promise<RemoteResult<WorkspaceFileStat>>
  read(
    sessionId: string,
    path: string,
    range: { offset?: number; limit?: number },
    signal?: AbortSignal,
  ): Promise<RemoteResult<WorkspaceFileText>>
  readBytes(
    sessionId: string,
    path: string,
    options: { baseFile?: string },
    signal?: AbortSignal,
  ): Promise<RemoteResult<WorkspaceFileBytes>>
}

export async function resolveIdentity(
  remote: WorkspaceFilesRemote,
  sessionId: string,
  path: string,
  signal?: AbortSignal,
): Promise<MindPptFileIdentity> {
  const result = await remote.stat(sessionId, path, signal)
  if (!result.ok || !result.value) {
    throw new Error(result.error?.message ?? 'Unable to stat MindPPT file')
  }
  return { sessionId, path, absolutePath: result.value.absolutePath }
}

export async function readWholeSource(
  remote: WorkspaceFilesRemote,
  sessionId: string,
  path: string,
  signal?: AbortSignal,
): Promise<string> {
  const parts: string[] = []
  let offset = 1
  while (true) {
    const result = await remote.read(sessionId, path, { offset }, signal)
    if (!result.ok || !result.value) {
      throw new Error(result.error?.message ?? 'Unable to read MindPPT file')
    }
    const page = result.value
    parts.push(page.text)
    if (page.eof) return parts.join('\n')
    if (page.lines <= 0) throw new Error('MindPPT file read made no progress')
    offset += page.lines
  }
}

export function relatedReader(
  remote: WorkspaceFilesRemote,
  sessionId: string,
  baseFile: string,
) {
  return async (source: string, signal: AbortSignal): Promise<RelatedAsset | undefined> => {
    const result = await remote.readBytes(
      sessionId,
      source,
      { baseFile },
      signal,
    )
    if (!result.ok || !result.value) return undefined
    return {
      data: result.value.data,
      mimeType: mimeType(source),
    }
  }
}

function mimeType(path: string): RelatedAsset['mimeType'] {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  return 'image/jpeg'
}
