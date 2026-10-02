import type {
  BinaryFileData,
  BinaryFiles,
  DataURL,
} from '@excalidraw/excalidraw/types'

import type { CanvasAssetRequest } from 'dsh-mindppt-canvas-excalidraw'
import type { MindPptDiagnostic } from 'dsh-mindppt-code-parser'

export interface PlaygroundAssetFile {
  mimeType: BinaryFileData['mimeType']
  dataURL: string
}

export interface PlaygroundAssetContext {
  documentPath: string
  files: Readonly<Record<string, PlaygroundAssetFile>>
}

export interface ResolvedAssets {
  files: BinaryFiles
  diagnostics: MindPptDiagnostic[]
}

const LOCAL_ORIGIN = 'https://mindppt.local'

export function resolveCanvasAssets(
  requests: readonly CanvasAssetRequest[],
  context?: PlaygroundAssetContext,
): ResolvedAssets {
  const files: BinaryFiles = {}
  const diagnostics: MindPptDiagnostic[] = []

  for (const request of requests) {
    const path = context
      ? resolveRelativeAssetPath(context.documentPath, request.source)
      : undefined

    if (!context || !path) {
      diagnostics.push({
        severity: 'warning',
        message: 'Asset "' + request.source + '" must resolve from a local relative path',
        sourceRange: request.sourceRange,
      })
      continue
    }

    const asset = context.files[path]
    if (!asset) {
      diagnostics.push({
        severity: 'warning',
        message: 'Local asset not found: ' + request.source,
        sourceRange: request.sourceRange,
      })
      continue
    }

    const data: BinaryFileData = {
      id: request.fileId,
      mimeType: asset.mimeType,
      dataURL: asset.dataURL as DataURL,
      created: 0,
    }
    Object.assign(files, { [request.fileId]: data })
  }

  return { files, diagnostics }
}

function resolveRelativeAssetPath(
  documentPath: string,
  source: string,
): string | undefined {
  if (
    source.startsWith('/')
    || source.startsWith('//')
    || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(source)
  ) {
    return undefined
  }

  const normalizedDocument = documentPath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
  const documentUrl = new URL('/' + normalizedDocument, LOCAL_ORIGIN)
  const resolved = new URL(source, documentUrl)

  if (resolved.origin !== LOCAL_ORIGIN) return undefined
  return decodeURIComponent(resolved.pathname.replace(/^\/+/, ''))
}
