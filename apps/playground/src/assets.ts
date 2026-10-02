import type {
  BinaryFileData,
  BinaryFiles,
  DataURL,
} from '@excalidraw/excalidraw/types'

import type { CanvasAssetRequest } from 'dsh-mindppt-canvas-excalidraw'
import type { MindPptDiagnostic } from 'dsh-mindppt-code-parser'

import { binaryFileId } from './binary-id.ts'

export interface PlaygroundAssetFile {
  mimeType: BinaryFileData['mimeType']
  dataURL: string
}

export interface PlaygroundAssetContext {
  documentPath: string
  files: Readonly<Record<string, PlaygroundAssetFile>>
}

type BinaryFileId = BinaryFileData['id']

export interface ResolvedAssets {
  files: BinaryFiles
  elementFileIds: Readonly<Record<string, BinaryFileId>>
  diagnostics: MindPptDiagnostic[]
}

const LOCAL_ORIGIN = 'https://mindppt.local'

export function resolveCanvasAssets(
  requests: readonly CanvasAssetRequest[],
  context?: PlaygroundAssetContext,
): ResolvedAssets {
  const files: BinaryFiles = {}
  const elementFileIds: Record<string, BinaryFileId> = {}
  const diagnostics: MindPptDiagnostic[] = []

  for (const request of requests) {
    if (!context) {
      diagnostics.push(relativePathWarning(request))
      continue
    }

    const resolution = resolveRelativeAssetPath(
      context.documentPath,
      request.source,
    )
    if (!resolution.path) {
      diagnostics.push({
        severity: 'warning',
        message: resolution.message ?? relativePathMessage(request.source),
        sourceRange: request.sourceRange,
      })
      continue
    }

    const asset = context.files[resolution.path]
    if (!asset) {
      diagnostics.push({
        severity: 'warning',
        message: 'Local asset not found: ' + request.source,
        sourceRange: request.sourceRange,
      })
      continue
    }

    const fileId = binaryFileId(
      request.source,
      asset.mimeType,
      asset.dataURL,
    ) as BinaryFileId
    const data: BinaryFileData = {
      id: fileId,
      mimeType: asset.mimeType,
      dataURL: asset.dataURL as DataURL,
      created: 0,
    }
    files[fileId] = data

    for (const elementId of request.elementIds) {
      elementFileIds[elementId] = fileId
    }
  }

  return { files, elementFileIds, diagnostics }
}

function resolveRelativeAssetPath(
  documentPath: string,
  source: string,
): { path?: string; message?: string } {
  if (
    source.startsWith('/')
    || source.startsWith('//')
    || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(source)
  ) {
    return {}
  }

  try {
    const normalizedDocument = documentPath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
    const documentUrl = new URL('/' + normalizedDocument, LOCAL_ORIGIN)
    const resolved = new URL(source, documentUrl)

    if (resolved.origin !== LOCAL_ORIGIN) return {}
    return {
      path: decodeURIComponent(resolved.pathname.replace(/^\/+/, '')),
    }
  } catch {
    return {
      message: 'Unable to resolve local asset path: ' + source,
    }
  }
}

function relativePathWarning(
  request: CanvasAssetRequest,
): MindPptDiagnostic {
  return {
    severity: 'warning',
    message: relativePathMessage(request.source),
    sourceRange: request.sourceRange,
  }
}

function relativePathMessage(source: string): string {
  return 'Asset "' + source + '" must resolve from a local relative path'
}
