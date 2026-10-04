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
    backgroundColor: '#ffffff',
    strokeColor: '#d0d0d0',
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
      textAlign:
        element.kind === 'title' || element.kind === 'subtitle'
          ? 'center'
          : 'left',
      verticalAlign:
        element.kind === 'title' || element.kind === 'subtitle'
          ? 'middle'
          : 'top',
      strokeColor: '#1b1b1f',
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
    backgroundColor: '#f8f9fa',
    strokeColor: '#adb5bd',
    strokeStyle: 'dashed',
    fillStyle: 'solid',
    roughness: 0,
    label: {
      text: contentText(element),
      fontSize: contentFontSize(element),
      textAlign: 'left',
      verticalAlign: 'top',
      strokeColor: '#1b1b1f',
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
      return 48
    case 'subtitle':
      return 30
    case 'text':
    case 'list':
    case 'image':
      return 24
    case 'extension':
      return 22
    case 'table':
    case 'bar-chart':
      return 17
  }
}
