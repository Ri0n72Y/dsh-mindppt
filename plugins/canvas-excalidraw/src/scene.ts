import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type {
  ContentNode,
  MindPptStructure,
  SlideNode,
} from 'dsh-mindppt-code-parser'

import { semanticImageFileId } from './assets.ts'
import type { ExtensionRenderer } from './extension-renderer.ts'
import { renderSoftLinkScene } from './soft-link-scene.ts'
import { renderBarChart, renderTable } from './structured-scene.ts'
import { renderTreeScene } from './tree-scene.ts'
import { neutral, typeSize } from './visual-style.ts'

export type ExcalidrawScene = ExcalidrawElementSkeleton[]

export function renderScene(
  structure: MindPptStructure,
  extensionRenderers?: ReadonlyMap<string, ExtensionRenderer>,
): ExcalidrawScene {
  return [
    ...renderTreeScene(structure),
    ...renderSoftLinkScene(structure),
    ...structure.slides.flatMap((slide) =>
      renderSlide(slide, extensionRenderers),
    ),
  ]
}

function renderSlide(
  slide: SlideNode,
  extensionRenderers?: ReadonlyMap<string, ExtensionRenderer>,
): ExcalidrawScene {
  const surface: ExcalidrawElementSkeleton = {
    type: 'rectangle',
    id: 'slide:' + slide.id + '/surface',
    x: slide.x,
    y: slide.y,
    width: slide.width,
    height: slide.height,
    backgroundColor: neutral.surface,
    strokeColor: neutral.border,
    fillStyle: 'solid',
    strokeWidth: 1,
    roughness: 0,
  }

  const content = slide.elements.flatMap((element) =>
    renderContent(slide, element, extensionRenderers),
  )

  const frame: ExcalidrawElementSkeleton = {
    type: 'frame',
    id: 'slide:' + slide.id,
    children: [surface, ...content].flatMap((child) =>
      child.id ? [child.id] : [],
    ),
    name: slide.id,
  }

  return [surface, ...content, frame]
}

function renderContent(
  slide: SlideNode,
  element: ContentNode,
  extensionRenderers?: ReadonlyMap<string, ExtensionRenderer>,
): ExcalidrawScene {
  if (element.kind === 'image') {
    return [{
      type: 'image',
      id: element.id,
      x: slide.x + element.x,
      y: slide.y + element.y,
      width: element.width,
      height: element.height,
      fileId: semanticImageFileId(element.id),
      status: 'saved',
      scale: [1, 1],
    }]
  }

  if (element.kind === 'extension') {
    const renderer = extensionRenderers?.get(element.type)
    if (renderer) {
      try {
        const specialized = renderer({ slide, element })
        if (Array.isArray(specialized) && specialized.length > 0) {
          return specialized
        }
      } catch {
        // Renderer failure is local to this node; fallback remains valid.
      }
    }
    return renderExtensionFallback(slide, element)
  }

  if (element.kind === 'table') return renderTable(slide, element)
  if (element.kind === 'bar-chart') return renderBarChart(slide, element)

  const heading = element.kind === 'title' || element.kind === 'subtitle'
  const centered = slide.layout === 'hero'
    || (!slide.layout && slide.elements.length === 1 && element.kind === 'title')

  return [{
    type: 'rectangle',
    id: element.id + '/box',
    x: slide.x + element.x,
    y: slide.y + element.y,
    width: element.width,
    height: element.height,
    backgroundColor: 'transparent',
    strokeColor: 'transparent',
    fillStyle: 'solid',
    roughness: 0,
    label: {
      text: contentText(element),
      fontSize: contentFontSize(element),
      textAlign: heading && centered ? 'center' : 'left',
      verticalAlign: heading ? 'middle' : 'top',
      strokeColor: element.kind === 'title'
        ? neutral.title
        : element.kind === 'subtitle' ? neutral.secondary : neutral.body,
    },
  }]
}

function renderExtensionFallback(
  slide: SlideNode,
  element: Extract<ContentNode, { kind: 'extension' }>,
): ExcalidrawScene {
  return [{
    type: 'rectangle',
    id: element.id + '/box',
    x: slide.x + element.x,
    y: slide.y + element.y,
    width: element.width,
    height: element.height,
    backgroundColor: neutral.panel,
    strokeColor: neutral.border,
    strokeStyle: 'dashed',
    fillStyle: 'solid',
    roughness: 0,
    label: {
      text: contentText(element),
      fontSize: contentFontSize(element),
      textAlign: 'left',
      verticalAlign: 'top',
      strokeColor: neutral.body,
    },
  }]
}

function contentText(element: ContentNode): string {
  if (element.kind === 'list') {
    return element.items
      .map((item, index) =>
        element.ordered ? (index + 1) + '. ' + item : '• ' + item,
      )
      .join('\n')
  }

  if (element.kind === 'extension') {
    return '[' + (element.type || 'extension') + ']\n' + element.raw
  }

  if (element.kind === 'image') return element.alt
  if (element.kind === 'table' || element.kind === 'bar-chart') return ''
  return element.text
}

function contentFontSize(element: ContentNode): number {
  switch (element.kind) {
    case 'title':
      return typeSize.title
    case 'subtitle':
      return typeSize.subtitle
    case 'text':
    case 'list':
    case 'image':
      return typeSize.body
    case 'extension':
      return typeSize.extension
    case 'table':
    case 'bar-chart':
      return typeSize.data
  }
}
