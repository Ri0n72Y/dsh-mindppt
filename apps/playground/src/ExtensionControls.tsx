import type { PlaygroundRuntime } from './runtime.ts'

export function ExtensionControls({
  rendererTypes,
  runtime,
}: {
  rendererTypes: readonly string[]
  runtime: PlaygroundRuntime
}) {
  const latexActive = rendererTypes.includes('latex')

  return (
    <section
      className="camera-controls extension-controls"
      aria-label="Extension renderers"
    >
      <div className="camera-heading">
        <span className="panel-label">Extensions</span>
        <span
          className="camera-current"
          aria-label="Active extension renderers"
        >
          Active: {rendererTypes.length ? rendererTypes.join(', ') : 'none'}
        </span>
      </div>

      <div className="camera-child-list">
        <button
          type="button"
          aria-label="Enable LaTeX renderer"
          disabled={latexActive}
          onClick={() => {
            void runtime.enableLatex()
          }}
        >
          Enable LaTeX
        </button>
        <button
          type="button"
          aria-label="Disable LaTeX renderer"
          disabled={!latexActive}
          onClick={() => {
            void runtime.disableLatex()
          }}
        >
          Disable LaTeX
        </button>
      </div>
    </section>
  )
}
