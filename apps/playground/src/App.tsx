import { useRef, useSyncExternalStore } from 'react'

import type { MindPptDiagnostic } from 'dsh-mindppt-code-parser'

import { MindPptCanvas } from './MindPptCanvas.tsx'
import type { PlaygroundRuntime } from './runtime.ts'

interface AppProps {
  runtime: PlaygroundRuntime
}

export function App({ runtime }: AppProps) {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  )
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const hasError = snapshot.diagnostics.some((diagnostic) => diagnostic.severity === 'error')
  const hasWarning = snapshot.diagnostics.some((diagnostic) => diagnostic.severity === 'warning')

  const focusDiagnostic = (diagnostic: MindPptDiagnostic) => {
    const editor = editorRef.current
    if (!editor) return

    editor.focus()
    if (!diagnostic.sourceRange) return

    editor.setSelectionRange(
      diagnostic.sourceRange.start,
      diagnostic.sourceRange.end,
    )
  }

  return (
    <main className="playground">
      <aside className="source-panel">
        <div className="panel-heading">
          <span className="panel-label">MindPPT source</span>
          <span
            className={
              hasError
                ? 'status-error'
                : hasWarning
                  ? 'status-warning'
                  : 'status-ok'
            }
          >
            {hasError
              ? 'Compile error'
              : hasWarning
                ? 'Compiled with warning'
                : 'Compiled'}
          </span>
        </div>

        <textarea
          ref={editorRef}
          aria-label="MindPPT source editor"
          className="source-editor"
          spellCheck={false}
          value={snapshot.source}
          onChange={(event) => runtime.setSource(event.target.value)}
        />

        <div className="diagnostics" aria-live="polite">
          {snapshot.diagnostics.map((diagnostic, index) => (
            <button
              className={`diagnostic diagnostic-${diagnostic.severity}`}
              key={index}
              type="button"
              onClick={() => focusDiagnostic(diagnostic)}
            >
              {diagnosticLocation(snapshot.source, diagnostic)}
              {diagnostic.message}
            </button>
          ))}
        </div>

        <section className="camera-controls" aria-label="Camera controls">
          <div className="camera-heading">
            <span className="panel-label">Camera</span>
            <span className="camera-current">
              Current: {snapshot.camera.currentSlideId ?? 'overview'}
            </span>
          </div>

          <select
            aria-label="Camera slide target"
            className="camera-select"
            value=""
            onChange={(event) => {
              if (event.target.value) runtime.focusSlide(event.target.value)
            }}
          >
            <option value="" disabled>Focus slide…</option>
            {snapshot.camera.slideIds.map((slideId) => (
              <option key={slideId} value={slideId}>{slideId}</option>
            ))}
          </select>

          <button
            type="button"
            disabled={!snapshot.camera.parentSlideId}
            aria-label={
              snapshot.camera.parentSlideId
                ? `Focus parent ${snapshot.camera.parentSlideId}`
                : 'No parent slide'
            }
            onClick={() => runtime.focusParent()}
          >
            Parent: {snapshot.camera.parentSlideId ?? '—'}
          </button>

          <div className="camera-children">
            <span className="camera-label">Children</span>
            <div className="camera-child-list">
              {snapshot.camera.childSlideIds.length
                ? snapshot.camera.childSlideIds.map((slideId) => (
                    <button
                      key={slideId}
                      type="button"
                      aria-label={`Focus child ${slideId}`}
                      onClick={() => runtime.focusChild(slideId)}
                    >
                      {slideId}
                    </button>
                  ))
                : <span className="camera-empty">—</span>}
            </div>
          </div>
        </section>
      </aside>

      <MindPptCanvas
        elements={snapshot.elements}
        focusRequest={snapshot.camera.focusRequest}
      />
    </main>
  )
}

function diagnosticLocation(
  source: string,
  diagnostic: MindPptDiagnostic,
): string {
  const start = diagnostic.sourceRange?.start
  if (start === undefined) return ''

  const before = source.slice(0, start)
  const line = before.split('\n').length
  const previousNewline = before.lastIndexOf('\n')
  const column = start - previousNewline

  return `L${line}:${column} · `
}
