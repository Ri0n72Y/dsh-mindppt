import type { MindPptDiagnostic } from 'dsh-mindppt-code-parser'
import type { CanvasAssetRequest } from 'dsh-mindppt-canvas-excalidraw'

export function assetWarning(request: CanvasAssetRequest): MindPptDiagnostic {
  return {
    severity: 'warning',
    message: 'Local asset unavailable: ' + request.source,
    sourceRange: request.sourceRange,
  }
}

export function fileId(source: string, data: Uint8Array<ArrayBuffer>): string {
  let hash = 2166136261
  for (const char of source) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  for (const byte of data) hash = Math.imul(hash ^ byte, 16777619)
  return (hash >>> 0).toString(16).padStart(8, '0').repeat(5)
}

export function bytesToDataUrl(data: Uint8Array<ArrayBuffer>, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(new Blob([data], { type: mimeType }))
  })
}
