import { useState, useSyncExternalStore } from 'react'
import type { MindPptFileIdentity } from '../shared.ts'
import { MindPptCanvas } from './Canvas.tsx'
import { PresentationControls } from './Controls.tsx'
import type { BrowserMindPptRuntime } from './runtime.ts'
import { SourceText } from './SourceText.tsx'

export interface WorkbenchSession {
  identity: MindPptFileIdentity
  runtime: BrowserMindPptRuntime
}

export function InteractiveWorkbench({ session }: { session: WorkbenchSession }) {
  const { runtime } = session
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  )
  const [showCode, setShowCode] = useState(false)

  return (
    <main
      style={{
        ...workbenchStyle,
        gridTemplateColumns: showCode ? 'minmax(0, 1fr) 360px' : 'minmax(0, 1fr)',
      }}
      aria-label="MindPPT interactive workbench"
    >
      <section style={stageStyle} aria-label="MindPPT presentation stage">
        <MindPptCanvas
          elements={snapshot.elements}
          files={snapshot.files}
          focusRequest={snapshot.camera.focusRequest}
          onFontMetricsReady={runtime.refreshElements}
        />
        <button
          type="button"
          style={codeToggleStyle}
          aria-expanded={showCode}
          onClick={() => setShowCode(value => !value)}
        >
          {showCode ? 'Hide Code' : 'Show Code'}
        </button>
        <details style={navigationStyle}>
          <summary>Navigation</summary>
          <PresentationControls runtime={runtime} snapshot={snapshot} />
        </details>
      </section>
      {showCode && (
        <aside style={sourcePanelStyle} aria-label="MindPPT code panel">
          <SourceText source={snapshot.source} diagnostics={snapshot.diagnostics} />
        </aside>
      )}
    </main>
  )
}

const workbenchStyle = {
  position: 'fixed', inset: 0, zIndex: 2147483647,
  display: 'grid', margin: 0, background: '#fff',
} as const

const stageStyle = {
  position: 'relative', minWidth: 0, minHeight: 0,
} as const

const codeToggleStyle = {
  position: 'absolute', top: 12, right: 12, zIndex: 10,
  padding: 8, background: '#fff', border: '1px solid #ddd',
} as const

const navigationStyle = {
  position: 'absolute', bottom: 12, left: 12, zIndex: 10,
  maxWidth: 'calc(100% - 24px)', maxHeight: '50%',
  overflow: 'auto', padding: 8,
  background: '#fff', border: '1px solid #ddd',
} as const

const sourcePanelStyle = {
  display: 'flex', flexDirection: 'column', minHeight: 0,
  gap: 8, padding: 8, borderLeft: '1px solid #ddd', overflow: 'auto',
} as const
