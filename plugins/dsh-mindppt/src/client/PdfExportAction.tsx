import { useEffect, useRef, useState } from 'react'
import type { BrowserMindPptRuntime, BrowserSnapshot } from './runtime.ts'


export function pdfFilename(path: string): string {
  const name = path.replace(/\\/g, '/').split('/').at(-1) ?? ''
  const stem = name.replace(/\.mindppt$/i, '')
    .replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_')
    .replace(/^\.+/, '').trim().slice(0, 80)
  return (stem || 'presentation') + '.pdf'
}

export function PdfExportAction({ runtime, snapshot, filename, checkSource }: {
  runtime: BrowserMindPptRuntime
  snapshot: BrowserSnapshot
  filename: string
  checkSource(signal: AbortSignal): Promise<void>
}) {
  const active = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  useEffect(() => () => { active.current?.abort() }, [])

  async function exportPdf() {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setProgress('Preparing fonts…')
    setError('')
    try {
      await document.fonts.ready
      controller.signal.throwIfAborted()
      const { assertExportable, createSlidesPdf } = await import('./pdf-export.ts')
      runtime.refreshElements() // remeasure labels with the final browser font metrics
      const ready = runtime.getSnapshot()
      assertExportable(ready)
      const { revision, source, structure, elements, files } = ready
      const ensureCurrent = async () => {
        controller.signal.throwIfAborted()
        const current = runtime.getSnapshot()
        assertExportable(current)
        if (current.revision !== revision || current.source !== source) {
          throw new Error('MindPPT source changed during PDF export')
        }
        await checkSource(controller.signal)
        controller.signal.throwIfAborted()
        if (runtime.getSnapshot().revision !== revision) {
          throw new Error('MindPPT source changed during PDF export')
        }
      }
      setProgress('Rendering slides…')
      const bytes = await createSlidesPdf({
        slides: structure.slides, elements, files,
        signal: controller.signal, ensureCurrent,
        onProgress(done, total) { setProgress('Rendering ' + done + ' / ' + total) },
      })
      controller.signal.throwIfAborted()
      downloadPdf(bytes, filename)
      setProgress('PDF downloaded')
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : String(cause))
        setProgress('')
      }
    } finally {
      if (active.current === controller) active.current = null
      setBusy(false)
    }
  }

  const available = snapshot.structureCurrent && snapshot.assetStatus === 'ready'
  const blocked = !snapshot.structureCurrent ? 'Current source is invalid'
    : snapshot.assetStatus === 'pending' ? 'Loading local images'
      : snapshot.assetStatus === 'failed' ? 'Local images missing or unreadable' : ''
  return (
    <>
      <button type="button" style={buttonStyle} disabled={busy || !available}
        onClick={() => void exportPdf()}>
        {busy ? 'Exporting PDF…' : 'Export as PDF'}
      </button>
      {(progress || blocked) && <small role="status" style={noticeStyle}>{progress || blocked}</small>}
      {error && <small role="alert" style={noticeStyle}>{error}</small>}
    </>
  )
}

function downloadPdf(bytes: Uint8Array, filename: string): void {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  try { link.click() } finally {
    link.remove()
    // Keep the blob alive until the browser has consumed the click.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

const buttonStyle = {
  minHeight: 30, padding: '5px 8px', textAlign: 'center',
  border: '0.5px solid var(--dsw-alias-border-l2, #ddd)',
  borderRadius: 'var(--dsw-radius-sm, 6px)',
  background: 'var(--dsw-alias-bg-layer-1, #fff)',
  color: 'var(--dsw-alias-label-primary, #222)',
  font: 'inherit', cursor: 'pointer',
} as const
const noticeStyle = {
  maxWidth: 240, overflowWrap: 'anywhere',
  color: 'var(--dsw-alias-label-secondary, #666)',
} as const
