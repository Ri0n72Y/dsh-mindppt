import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AuthoringSurface } from '../src/client/AuthoringSurface.tsx'
import { InteractiveWorkbench } from '../src/client/InteractiveWorkbench.tsx'
import { PreviewAction, previewPageUrl } from '../src/client/PreviewAction.tsx'
import { PreviewStatus } from '../src/client/PreviewStatus.tsx'
import { createDocumentViewCell, documentViewCell } from '../src/client/view-state.ts'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => import('./dsh-ui-primitives.mock.tsx'))

vi.mock('../src/client/Canvas.tsx', () => ({
  MindPptPanorama: (props: { elements: unknown[] }) => (
    <div
      data-panorama="true"
      data-elements={props.elements.length}
      data-focus={String('focusRequest' in props)}
    />
  ),
  MindPptCanvas: (props: { focusRequest?: { revision: number } }) => (
    <div
      data-interactive-canvas="true"
      data-focus-revision={props.focusRequest?.revision ?? ''}
    />
  ),
}))

function runtime() {
  const snapshot = {
    source: 'mindppt\nslide root {\n  # Root\n}\n',
    diagnostics: [], structureCurrent: true,
    elements: [{ id: 'root' }, { id: 'child' }], files: {},
    camera: {
      focusRequest: { revision: 7 }, slideIds: ['root', 'child'],
      parentSlideId: 'root', childSlideIds: ['child'], selectedPathId: 'main',
      pathOptions: [{ id: 'main', name: 'Main path' }],
      canPathPrevious: true, canPathNext: true,
      outgoingSoftLinks: [{ id: 'jump', targetSlideId: 'child' }],
    },
    rendererTypes: ['latex'],
  }
  return {
    subscribe: () => () => {}, getSnapshot: () => snapshot,
    setSource: vi.fn(), refreshElements: vi.fn(), focusSlide: vi.fn(),
    focusParent: vi.fn(), focusChild: vi.fn(), selectPath: vi.fn(),
    pathPrevious: vi.fn(), pathNext: vi.fn(), followSoftLink: vi.fn(),
  }
}

function surface(view: 'code' | 'panorama') {
  return renderToStaticMarkup(
    <AuthoringSurface
      runtime={runtime() as never}
      error={undefined}
      scrollportRef={() => {}}
      view={view}
    />,
  )
}

describe('MindPPT document UI contract', () => {
  it('defaults each tab resource to Code and keeps view state local', () => {
    const signal = new AbortController().signal
    const first = documentViewCell(signal, 'dsh-resource://file/session/s/deck.mindppt')
    const same = documentViewCell(signal, 'dsh-resource://file/session/s/deck.mindppt')
    const other = documentViewCell(signal, 'dsh-resource://file/session/s/other.mindppt')
    expect(first).toBe(same)
    expect(first.getSnapshot()).toBe('code')
    first.set('panorama')
    expect(same.getSnapshot()).toBe('panorama')
    expect(other.getSnapshot()).toBe('code')
    const fresh = createDocumentViewCell()
    fresh.set('panorama')
    fresh.set('code')
    expect(fresh.getSnapshot()).toBe('code')
  })

  it('header Preview shares view state and advertises Code on return', () => {
    const signal = new AbortController().signal
    const address = 'dsh-resource://file/session/s/deck.mindppt'
    const props = {
      content: { kind: 'renderer' as const },
      useTabInfo: () => ({ tab: { signal, navigation: { address } } }),
    }
    const preview = renderToStaticMarkup(<PreviewAction {...props} />)
    expect(preview).toContain('Preview')
    expect(preview).toContain('MindPPT view controls')
    expect(preview).toContain('aria-haspopup="menu"')
    expect(preview).toContain('aria-expanded="false"')
    expect(preview).toContain('var(--dsw-alias-border-l3)')
    expect(preview).toContain('data-mindppt-preview-split')
    expect(preview).toContain('button:focus-visible')
    expect(preview).toContain('box-shadow: inset 0 0 0 2px var(--dsw-alias-label-primary)')
    documentViewCell(signal, address).set('panorama')
    expect(renderToStaticMarkup(<PreviewAction {...props} />)).toContain('Code')
  })

  it('Code shows read-only source; Panorama mounts full scene without Camera input', () => {
    const code = surface('code')
    expect(code).toContain('aria-label="MindPPT source text"')
    expect(code).toContain('<pre')
    expect(code).not.toContain('<textarea')
    expect(code).not.toContain('data-panorama="true"')
    const panorama = surface('panorama')
    expect(panorama).not.toContain('aria-label="MindPPT source text"')
    expect(panorama).toContain('data-panorama="true"')
    expect(panorama).toContain('data-elements="2"')
    expect(panorama).toContain('data-focus="false"')
  })

  it('announces invalid-first and stale-last-good previews with source location', () => {
    const source = 'mindppt\n\ndeck {\n}\n'
    const failed = {
      ...runtime().getSnapshot(), source, structureCurrent: false,
      elements: [], diagnostics: [{
        severity: 'error',
        message: 'Unexpected document statement: text',
        sourceRange: { start: 9, end: 15 },
      }],
    }
    const first = renderToStaticMarkup(<PreviewStatus snapshot={failed as never} />)
    expect(first).toContain('Compile failed')
    expect(first).toContain('line 3:1')
    expect(first).toContain('Open Code')

    const stale = renderToStaticMarkup(
      <PreviewStatus snapshot={{ ...failed, elements: [{ id: 'old' }] } as never} />,
    )
    expect(stale).toContain('Last-good preview')
    expect(stale).toContain('previous successful scene')
    expect(renderToStaticMarkup(
      <PreviewStatus snapshot={{ ...failed, structureCurrent: true } as never} />,
    )).toBe('')
  })

  it('uses controlled view-only Excalidraw without blocking panorama pointers', () => {
    const canvas = readFileSync(
      new URL('../src/client/Canvas.tsx', import.meta.url), 'utf8',
    )
    expect(canvas).toContain('viewModeEnabled')
    expect(canvas).toContain('zenModeEnabled={true}')
    expect(canvas).toContain('.mindppt-view-only .layer-ui__wrapper__footer-right')
    expect(canvas).not.toContain("pointerEvents: 'none'")
  })

  it('builds Preview on side URL without changing workspace address', () => {
    const address = 'dsh-resource://file/session/s/deck.mindppt'
    const url = new URL(previewPageUrl('https://dsh.local/app?x=1', address))
    expect(url.searchParams.get('x')).toBe('1')
    expect(url.searchParams.get('mindppt-preview')).toBe(address)
  })

  it('keeps Preview on side outside Agent selection ownership', () => {
    const source = readFileSync(
      new URL('../src/client/PreviewPage.tsx', import.meta.url),
      'utf8',
    )
    expect(source).toContain('readWholeSource')
    expect(source).not.toContain('queueClientSelection')
    expect(source).not.toContain('postDocument')
    expect(source).not.toContain("action: 'select'")
    expect(source).not.toContain("action: 'clear'")
  })

  it('new-tab preview defaults to full-width canvas and collapsed Code', () => {
    const model = runtime()
    const html = renderToStaticMarkup(
      <InteractiveWorkbench
        session={{
          identity: { sessionId: 's', path: 'deck.mindppt' },
          runtime: model as never,
        }}
      />,
    )
    expect(html).toContain('Show Code')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('<aside')
    expect(html).not.toContain('aria-label="MindPPT source text"')
    expect(html).toContain('<details')
    expect(html).toContain('Navigation')
    expect(html).toContain('top:12px;right:12px')
    expect(html).toContain('flex-direction:column')
    expect(html).toContain('--dsw-alias-bg-layer-1')
    expect(html).toContain('aria-label="Presentation path"')
    expect(html).toContain('Previous')
    expect(html).toContain('Next')
    expect(html).toContain('Link: child')
    expect(html).toContain('data-focus-revision="7"')
  })
})
