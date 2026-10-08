import { readFileSync } from 'node:fs'
import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AuthoringSurface } from '../src/client/AuthoringSurface.tsx'
import { InteractiveWorkbench } from '../src/client/InteractiveWorkbench.tsx'
import { PreviewAction, previewPageUrl } from '../src/client/PreviewAction.tsx'
import { createDocumentViewCell, documentViewCell } from '../src/client/view-state.ts'

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
      identity={undefined}
      error={undefined}
      editor={createRef<HTMLTextAreaElement>()}
      writeTail={{ current: Promise.resolve('v1') }}
      selectionTail={{ current: Promise.resolve() }}
      pendingWrites={{ current: 0 }}
      editRevision={{ current: 0 }}
      reload={() => {}}
      onSaved={() => {}}
      scrollportRef={() => {}}
      onError={() => {}}
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
    expect(renderToStaticMarkup(<PreviewAction {...props} />)).toContain('Preview')
    documentViewCell(signal, address).set('panorama')
    expect(renderToStaticMarkup(<PreviewAction {...props} />)).toContain('Code')
  })

  it('Code mounts only the editor; Panorama mounts full scene without Camera input', () => {
    const code = surface('code')
    expect(code).toContain('aria-label="MindPPT source editor"')
    expect(code).not.toContain('data-panorama="true"')
    const panorama = surface('panorama')
    expect(panorama).not.toContain('aria-label="MindPPT source editor"')
    expect(panorama).toContain('data-panorama="true"')
    expect(panorama).toContain('data-elements="2"')
    expect(panorama).toContain('data-focus="false"')
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

  it('new-tab workbench keeps editor, Camera, Path and SoftLink controls', () => {
    const model = runtime()
    const html = renderToStaticMarkup(
      <InteractiveWorkbench
        session={{
          identity: { sessionId: 's', path: 'deck.mindppt' },
          runtime: model as never,
          version: 'v1',
        }}
        remote={{ readBytes: vi.fn() } as never}
      />,
    )
    expect(html).toContain('aria-label="MindPPT source editor"')
    expect(html).toContain('aria-label="Presentation path"')
    expect(html).toContain('Previous')
    expect(html).toContain('Next')
    expect(html).toContain('Link: child')
    expect(html).toContain('data-focus-revision="7"')
  })
})
