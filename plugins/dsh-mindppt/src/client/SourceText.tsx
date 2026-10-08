import type { BrowserSnapshot } from './runtime.ts'

export function SourceText({ source, diagnostics, error }: {
  source: string
  diagnostics: BrowserSnapshot['diagnostics']
  error?: string | undefined
}) {
  return (
    <>
      <pre aria-label="MindPPT source text" style={sourceStyle}>{source}</pre>
      {error && <div role="alert">{error}</div>}
      {diagnostics.length > 0 && (
        <div aria-label="MindPPT diagnostics" style={diagnosticStyle}>
          {diagnostics.map((diagnostic, index) => (
            <div key={index}>{diagnostic.severity}: {diagnostic.message}</div>
          ))}
        </div>
      )}
    </>
  )
}

const sourceStyle = {
  flex: 1,
  minHeight: 0,
  margin: 0,
  overflow: 'auto',
  whiteSpace: 'pre',
  fontFamily: 'monospace',
} as const

const diagnosticStyle = {
  display: 'grid',
  gap: 4,
} as const
