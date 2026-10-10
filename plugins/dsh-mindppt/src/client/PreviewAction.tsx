import { useState } from 'react'
import {
  Button, IconChevronDownOutlineRegular, Menu,
} from '@deepseek-ai/dsh-client-ui-primitives'
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

export function PreviewAction({ content, useTabInfo }: PreviewActionProps) {
  const { tab } = useTabInfo()
  const [view, setView] = useDocumentView(tab.signal, tab.navigation.address)
  const [open, setOpen] = useState(false)
  if (content.kind !== 'renderer') return null

  return (
    <>
      <style>{focusStyle}</style>
      <Menu
      open={open}
      autoFocus
      portal
      compact
      align="end"
      onClose={() => setOpen(false)}
      items={[{ id: 'side', label: 'Preview on side' }]}
      onSelect={() => {
        setOpen(false)
        window.open(
          previewPageUrl(window.location.href, tab.navigation.address),
          '_blank',
          'noopener',
        )
      }}
      anchor={(
        <span role="group" aria-label="MindPPT view controls" data-mindppt-preview-split="" style={splitStyle}>
          <Button
            variant="ghost"
            size="sm"
            style={mainStyle}
            onClick={() => {
              setOpen(false)
              setView(nextDocumentView(view))
            }}
          >
            {view === 'code' ? 'Preview' : 'Code'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            style={chevronStyle}
            aria-label="MindPPT preview options"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen(value => !value)}
          >
            <IconChevronDownOutlineRegular size={12} />
          </Button>
        </span>
      )}
      />
    </>
  )
}

const focusStyle = `
[data-mindppt-preview-split] > button:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover);
  box-shadow: inset 0 0 0 2px var(--dsw-alias-label-primary);
  outline: none;
}
`

const splitStyle = {
  display: 'inline-flex', alignItems: 'stretch', boxSizing: 'border-box',
  height: 28, overflow: 'hidden',
  border: '0.5px solid var(--dsw-alias-border-l3)',
  borderRadius: 'var(--dsw-radius-sm)',
  fontFamily: 'var(--dsw-font-family)',
} as const

const mainStyle = {
  height: '100%', borderRadius: 0, padding: '0 8px',
} as const

const chevronStyle = {
  height: '100%', minWidth: 26, padding: '0 6px', borderRadius: 0,
  borderLeft: '0.5px solid var(--dsw-alias-border-l3)',
  color: 'var(--dsw-alias-label-secondary)',
} as const
