import type { RefObject } from 'react'
import type { BrowserSnapshot } from './runtime.ts'

export function SourceEditor({
  source,
  diagnostics,
  error,
  editor,
  onChange,
}: {
  source: string
  diagnostics: BrowserSnapshot['diagnostics']
  error?: string | undefined
  editor: RefObject<HTMLTextAreaElement | null>
  onChange(source: string): void
}) {
  return (
    <>
      <textarea
        ref={editor}
        aria-label="MindPPT source editor"
        spellCheck={false}
        value={source}
        onChange={event => onChange(event.target.value)}
        style={editorStyle}
      />
      {error && <div role="alert" style={errorStyle}>{error}</div>}
      <div aria-live="polite" style={{ display: 'grid', gap: 4 }}>
        {diagnostics.map((diagnostic, index) => (
          <button
            key={index}
            type="button"
            style={{ textAlign: 'left' }}
            onClick={() => {
              editor.current?.focus()
              if (diagnostic.sourceRange) {
                editor.current?.setSelectionRange(
                  diagnostic.sourceRange.start,
                  diagnostic.sourceRange.end,
                )
              }
            }}
          >
            {diagnostic.severity}: {diagnostic.message}
          </button>
        ))}
      </div>
    </>
  )
}

const editorStyle = {
  width: '100%',
  minHeight: 180,
  flex: 1,
  resize: 'none',
  fontFamily: 'monospace',
  boxSizing: 'border-box',
} as const

const errorStyle = { padding: 8, background: '#fff4f4' } as const
