import { useState, useSyncExternalStore } from 'react'
import type { MindPptFileIdentity } from '../shared.ts'
import { MindPptCanvas } from './Canvas.tsx'
import { PresentationControls } from './Controls.tsx'
import { PreviewStatus } from './PreviewStatus.tsx'
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
        <PreviewStatus snapshot={snapshot} />
        <div style={toolbarStyle} aria-label="MindPPT preview tools">
          <button
            type="button"
            style={toolStyle}
            aria-expanded={showCode}
            onClick={() => setShowCode(value => !value)}
          >
            {showCode ? 'Hide Code' : 'Show Code'}
          </button>
          <details style={navigationStyle}>
            <summary style={toolStyle}>Navigation</summary>
            <div style={navigationPanelStyle}>
              <PresentationControls runtime={runtime} snapshot={snapshot} />
            </div>
          </details>
        </div>
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
  display: 'grid', margin: 0,
  background: 'var(--dsw-alias-bg-layer-1, #fff)',
} as const

const stageStyle = {
  position: 'relative', minWidth: 0, minHeight: 0,
} as const

const toolbarStyle = {
  position: 'absolute', top: 12, right: 12, zIndex: 10,
  display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6,
  fontFamily: 'var(--dsw-font-family, inherit)',
  fontSize: 'var(--dsh-content-font-size-secondary, 13px)',
  color: 'var(--dsw-alias-label-primary, #222)',
} as const

const toolStyle = {
  display: 'block', boxSizing: 'border-box', width: '100%',
  padding: '6px 12px', minHeight: 30,
  border: '0.5px solid var(--dsw-alias-border-l2, #ddd)',
  borderRadius: 'var(--dsw-radius-md, 8px)',
  color: 'inherit', background: 'var(--dsw-alias-bg-layer-1, #fff)',
  font: 'inherit', textAlign: 'center', cursor: 'pointer',
  boxShadow: '0 2px 8px #00000012',
} as const

const navigationStyle = { position: 'relative' } as const

const navigationPanelStyle = {
  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
  width: 'min(260px, calc(100vw - 24px))',
  maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
  padding: 8, boxSizing: 'border-box',
  border: '0.5px solid var(--dsw-alias-border-l3, #ddd)',
  borderRadius: 'var(--dsw-radius-lg, 12px)',
  background: 'var(--dsw-alias-bg-layer-1, #fff)',
  boxShadow: '0 8px 24px #0000001a, 0 2px 5px #00000009',
} as const

const sourcePanelStyle = {
  display: 'flex', flexDirection: 'column', minHeight: 0,
  gap: 8, padding: 8, overflow: 'auto',
  borderLeft: '0.5px solid var(--dsw-alias-border-l3, #ddd)',
  color: 'var(--dsw-alias-label-primary, #222)',
  background: 'var(--dsw-alias-bg-layer-1, #fff)',
} as const
