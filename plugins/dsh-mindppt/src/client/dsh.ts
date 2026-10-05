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

interface WorkspaceFileBytes extends WorkspaceFileStat {
  data: Uint8Array<ArrayBuffer>
  eof: boolean
}

export interface WorkspaceFilesRemote {
  readBytes(
    sessionId: string,
    path: string,
    options: { baseFile?: string },
    signal?: AbortSignal,
  ): Promise<RemoteResult<WorkspaceFileBytes>>
}

export async function readWholeSource(
  remote: WorkspaceFilesRemote,
  sessionId: string,
  path: string,
  signal?: AbortSignal,
): Promise<{ source: string; version: string }> {
  const result = await remote.readBytes(sessionId, path, {}, signal)
  if (!result.ok || !result.value) {
    throw new Error(result.error?.message ?? 'Unable to read MindPPT file')
  }
  let source: string
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(result.value.data)
  } catch {
    throw new Error('MindPPT source must be valid UTF-8')
  }
  if (source.includes(String.fromCharCode(0))) {
    throw new Error('MindPPT source must be text')
  }
  return { source, version: result.value.version }
}

export function relatedReader(
  remote: WorkspaceFilesRemote,
  sessionId: string,
  baseFile: string,
  addResource?: (address: string) => void,
) {
  return async (source: string, signal: AbortSignal): Promise<RelatedAsset | undefined> => {
    const result = await remote.readBytes(sessionId, source, { baseFile }, signal)
    if (!result.ok || !result.value) return undefined
    addResource?.(sessionFileAddress(sessionId, result.value.absolutePath))
    return { data: result.value.data, mimeType: mimeType(source) }
  }
}

function sessionFileAddress(sessionId: string, path: string): string {
  const encodedPath = path.replace(/\\/g, '/').split('/')
    .map(segment => encodeURIComponent(segment).replace(/%3A/gi, ':'))
    .join('/')
  return 'dsh-resource://file/session/' + encodeURIComponent(sessionId) + '/' + encodedPath
}

function mimeType(path: string): RelatedAsset['mimeType'] {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  return 'image/jpeg'
}
