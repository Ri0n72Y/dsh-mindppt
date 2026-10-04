import { useRef, useSyncExternalStore } from 'react'

import type { MindPptDiagnostic } from 'dsh-mindppt-code-parser'

import { CameraControls } from './CameraControls.tsx'
import { ExtensionControls } from './ExtensionControls.tsx'
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
              className={'diagnostic diagnostic-' + diagnostic.severity}
              key={index}
              type="button"
              onClick={() => focusDiagnostic(diagnostic)}
            >
              {diagnosticLocation(snapshot.source, diagnostic)}
              {diagnostic.message}
            </button>
          ))}
        </div>

        <ExtensionControls
          rendererTypes={snapshot.extensionRendererTypes}
          runtime={runtime}
        />

        <CameraControls camera={snapshot.camera} runtime={runtime} />
      </aside>

      <MindPptCanvas
        elements={snapshot.elements}
        files={snapshot.files}
        focusRequest={snapshot.camera.focusRequest}
        onFontMetricsReady={runtime.refreshElements}
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

  return 'L' + line + ':' + column + ' · '
}
