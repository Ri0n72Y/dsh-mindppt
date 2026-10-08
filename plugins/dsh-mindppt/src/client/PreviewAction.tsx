import { useState } from 'react'
import { nextDocumentView, useDocumentView } from './view-state.ts'

export interface PreviewActionProps {
  content: { kind: 'renderer' } | { kind: 'text' } | { kind: 'bytes' }
  useTabInfo(): {
    tab: {
      signal: AbortSignal
      navigation: { address: string }
    }
  }
}

export function previewPageUrl(base: string, resourceAddress: string): string {
  const url = new URL(base)
  url.searchParams.set('mindppt-preview', resourceAddress)
  return url.toString()
}

export function PreviewAction({
  content,
  useTabInfo,
}: PreviewActionProps) {
  const { tab } = useTabInfo()
  const [view, setView] = useDocumentView(
    tab.signal,
    tab.navigation.address,
  )
  const [open, setOpen] = useState(false)
  if (content.kind !== 'renderer') return null

  return (
    <div
      style={rootStyle}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        onClick={() => setView(nextDocumentView(view))}
      >
        {view === 'code' ? 'Preview' : 'Code'}
      </button>
      <button
        type="button"
        aria-label="MindPPT preview options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        ▾
      </button>
      {open && (
        <div role="menu" style={menuStyle}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              window.open(
                previewPageUrl(window.location.href, tab.navigation.address),
                '_blank',
                'noopener',
              )
            }}
          >
            Preview on side
          </button>
        </div>
      )}
    </div>
  )
}

const rootStyle = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'stretch',
} as const

const menuStyle = {
  position: 'absolute',
  zIndex: 10,
  top: 'calc(100% + 4px)',
  right: 0,
  padding: 4,
  border: '1px solid #ddd',
  background: '#fff',
  whiteSpace: 'nowrap',
} as const
