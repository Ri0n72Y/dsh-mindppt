import type { CameraView } from 'dsh-mindppt-camera'

import type { PlaygroundRuntime } from './runtime.ts'

interface CameraControlsProps {
  camera: CameraView
  runtime: PlaygroundRuntime
}

export function CameraControls({
  camera,
  runtime,
}: CameraControlsProps) {
  const activePathName = camera.pathOptions.find(
    ({ id }) => id === camera.selectedPathId,
  )?.name

  return (
    <section className="camera-controls" aria-label="Camera controls">
      <div className="camera-heading">
        <span className="panel-label">Camera</span>
        <span className="camera-current">
          Current: {camera.currentSlideId ?? 'overview'}
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
        {camera.slideIds.map((slideId) => (
          <option key={slideId} value={slideId}>{slideId}</option>
        ))}
      </select>

      <select
        aria-label="Presentation path"
        className="camera-select"
        value={camera.selectedPathId ?? ''}
        onChange={(event) => {
          if (event.target.value) runtime.selectPath(event.target.value)
        }}
      >
        <option value="" disabled>Select path…</option>
        {camera.pathOptions.map((path) => (
          <option key={path.id} value={path.id}>{path.name}</option>
        ))}
      </select>

      <span className="camera-path-state" aria-label="Presentation path state">
        {activePathName
          ? 'Path: '
            + activePathName
            + ' · '
            + ((camera.currentPathOccurrenceIndex ?? 0) + 1)
            + '/'
            + camera.currentPathOccurrenceCount
          : 'Path: —'}
      </span>

      <div className="camera-child-list">
        <button
          type="button"
          aria-label="Previous path occurrence"
          disabled={!camera.canPathPrevious}
          onClick={() => runtime.pathPrevious()}
        >
          Previous
        </button>
        <button
          type="button"
          aria-label="Next path occurrence"
          disabled={!camera.canPathNext}
          onClick={() => runtime.pathNext()}
        >
          Next
        </button>
      </div>

      <button
        type="button"
        disabled={!camera.parentSlideId}
        aria-label={
          camera.parentSlideId
            ? 'Focus parent ' + camera.parentSlideId
            : 'No parent slide'
        }
        onClick={() => runtime.focusParent()}
      >
        Parent: {camera.parentSlideId ?? '—'}
      </button>

      <NavigationTargets
        label="Children"
        empty="—"
        items={camera.childSlideIds.map((slideId) => ({
          id: slideId,
          label: slideId,
          ariaLabel: 'Focus child ' + slideId,
          onClick: () => runtime.focusChild(slideId),
        }))}
      />

      <NavigationTargets
        label="Soft links"
        empty="—"
        items={camera.outgoingSoftLinks.map((link) => ({
          id: link.id,
          label: link.targetSlideId,
          ariaLabel: 'Follow soft link to ' + link.targetSlideId,
          onClick: () => runtime.followSoftLink(link.id),
        }))}
      />
    </section>
  )
}

interface NavigationTarget {
  id: string
  label: string
  ariaLabel: string
  onClick: () => void
}

function NavigationTargets({
  label,
  empty,
  items,
}: {
  label: string
  empty: string
  items: NavigationTarget[]
}) {
  return (
    <div className="camera-children">
      <span className="camera-label">{label}</span>
      <div className="camera-child-list">
        {items.length
          ? items.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.ariaLabel}
                onClick={item.onClick}
              >
                {item.label}
              </button>
            ))
          : <span className="camera-empty">{empty}</span>}
      </div>
    </div>
  )
}
