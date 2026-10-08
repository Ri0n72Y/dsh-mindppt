import type { BrowserSnapshot } from './runtime.ts'

export function PreviewStatus({ snapshot }: { snapshot: BrowserSnapshot }) {
  if (snapshot.structureCurrent) return null
  const error = snapshot.diagnostics.find(item => item.severity === 'error')
  if (!error) return null
  const hasLastGood = snapshot.elements.length > 0
  const position = error.sourceRange
    ? sourcePosition(snapshot.source, error.sourceRange.start)
    : undefined
  return (
    <aside role="alert" style={statusStyle} aria-label="MindPPT preview status">
      <strong>{hasLastGood ? 'Last-good preview (outdated)' : 'Compile failed — no preview'}</strong>
      <span>{error.message}{position ? ' (line ' + position + ')' : ''}</span>
      <span style={hintStyle}>
        {hasLastGood ? 'Showing the previous successful scene. ' : ''}
        Open Code to correct the source.
      </span>
    </aside>
  )
}

function sourcePosition(source: string, offset: number): string {
  const before = source.slice(0, offset)
  const line = before.split('\n').length
  const column = before.length - before.lastIndexOf('\n')
  return line + ':' + column
}

const statusStyle = {
  position: 'absolute', top: 12, left: 12, zIndex: 5,
  display: 'flex', flexDirection: 'column', gap: 5,
  maxWidth: 'min(420px, calc(100% - 120px))', padding: '10px 12px',
  border: '0.5px solid var(--dsw-alias-border-l3, #ddd)',
  borderRadius: 'var(--dsw-radius-md, 8px)',
  background: 'var(--dsw-alias-bg-layer-1, #fff)',
  color: 'var(--dsw-alias-label-primary, #222)',
  fontFamily: 'var(--dsw-font-family, inherit)',
  fontSize: 'var(--dsh-content-font-size-secondary, 13px)',
  boxShadow: '0 2px 8px #00000014',
  pointerEvents: 'none',
} as const

const hintStyle = { color: 'var(--dsw-alias-label-secondary, #666)' } as const
