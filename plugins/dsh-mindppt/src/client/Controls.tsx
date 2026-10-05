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
        disabled={!camera.parentSlideId}
        onClick={() => runtime.focusParent()}
      >
        Parent
      </button>
      {camera.childSlideIds.map(id => (
        <button key={id} type="button" onClick={() => runtime.focusChild(id)}>
          Child: {id}
        </button>
      ))}
      <select
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
        disabled={!camera.canPathPrevious}
        onClick={() => runtime.pathPrevious()}
      >
        Previous
      </button>
      <button
        type="button"
        disabled={!camera.canPathNext}
        onClick={() => runtime.pathNext()}
      >
        Next
      </button>
      {camera.outgoingSoftLinks.map(link => (
        <button
          key={link.id}
          type="button"
          onClick={() => runtime.followSoftLink(link.id)}
        >
          Link: {link.targetSlideId}
        </button>
      ))}
    </div>
  )
}

const panelStyle = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  alignItems: 'center',
  padding: 8,
  borderBottom: '1px solid #ddd',
  background: '#fafafa',
} as const
