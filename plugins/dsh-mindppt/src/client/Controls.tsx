import type { BrowserMindPptRuntime, BrowserSnapshot } from './runtime.ts'

export function PresentationControls({
  runtime,
  snapshot,
}: {
  runtime: BrowserMindPptRuntime
  snapshot: BrowserSnapshot
}) {
  const camera = snapshot.camera
  return (
    <div style={panelStyle} aria-label="MindPPT presentation controls">
      <select
        style={controlStyle}
        aria-label="Camera slide target"
        value=""
        onChange={event => {
          if (event.target.value) runtime.focusSlide(event.target.value)
        }}
      >
        <option value="" disabled>Focus slide…</option>
        {camera.slideIds.map(id => <option key={id} value={id}>{id}</option>)}
      </select>
      <button
        type="button"
        style={controlStyle}
        disabled={!camera.parentSlideId}
        onClick={() => runtime.focusParent()}
      >
        Parent
      </button>
      {camera.childSlideIds.map(id => (
        <button key={id} type="button" style={controlStyle} onClick={() => runtime.focusChild(id)}>
          Child: {id}
        </button>
      ))}
      <select
        style={controlStyle}
        aria-label="Presentation path"
        value={camera.selectedPathId ?? ''}
        onChange={event => {
          if (event.target.value) runtime.selectPath(event.target.value)
        }}
      >
        <option value="" disabled>Path…</option>
        {camera.pathOptions.map(path => (
          <option key={path.id} value={path.id}>{path.name}</option>
        ))}
      </select>
      <button
        type="button"
        style={controlStyle}
        disabled={!camera.canPathPrevious}
        onClick={() => runtime.pathPrevious()}
      >
        Previous
      </button>
      <button
        type="button"
        style={controlStyle}
        disabled={!camera.canPathNext}
        onClick={() => runtime.pathNext()}
      >
        Next
      </button>
      {camera.outgoingSoftLinks.map(link => (
        <button
          key={link.id}
          type="button"
          style={controlStyle}
          onClick={() => runtime.followSoftLink(link.id)}
        >
          Link: {link.targetSlideId}
        </button>
      ))}
    </div>
  )
}

const panelStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6,
} as const

const controlStyle = {
  width: '100%', boxSizing: 'border-box', minHeight: 30, padding: '5px 8px',
  border: '0.5px solid var(--dsw-alias-border-l2, #ddd)',
  borderRadius: 'var(--dsw-radius-sm, 6px)',
  color: 'var(--dsw-alias-label-primary, #222)',
  background: 'var(--dsw-alias-bg-layer-2, #f6f6f6)',
  font: 'inherit', textAlign: 'left', cursor: 'pointer',
} as const
