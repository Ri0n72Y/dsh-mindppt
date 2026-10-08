import { useSyncExternalStore } from 'react'
import type { RefCallback } from 'react'
import { MindPptPanorama } from './Canvas.tsx'
import { PreviewStatus } from './PreviewStatus.tsx'
import { SourceText } from './SourceText.tsx'
import type { BrowserMindPptRuntime } from './runtime.ts'
import type { DocumentView } from './view-state.ts'

export function AuthoringSurface({ runtime, error, scrollportRef, view }: {
  runtime: BrowserMindPptRuntime
  error: string | undefined
  scrollportRef: RefCallback<HTMLElement>
  view: DocumentView
}) {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  )

  if (view === 'panorama') {
    return (
      <section
        ref={scrollportRef}
        style={panoramaRootStyle}
        aria-label="MindPPT panorama panel"
      >
        <MindPptPanorama
          elements={snapshot.elements}
          files={snapshot.files}
          onFontMetricsReady={runtime.refreshElements}
        />
        <PreviewStatus snapshot={snapshot} />
      </section>
    )
  }

  return (
    <section
      ref={scrollportRef}
      style={codeRootStyle}
      aria-label="MindPPT code panel"
    >
      <SourceText
        source={snapshot.source}
        diagnostics={snapshot.diagnostics}
        error={error}
      />
    </section>
  )
}

const codeRootStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 8,
  height: '100%',
  minHeight: 0,
  boxSizing: 'border-box',
} as const

const panoramaRootStyle = {
  position: 'relative',
  height: '100%',
  minHeight: 0,
} as const
