import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type {
  ContentNode,
  MindPptStructure,
  SlideNode,
} from 'dsh-mindppt-code-parser'

import { imageFileId } from './assets.ts'
import { renderTreeScene } from './tree-scene.ts'

export type ExcalidrawScene = ExcalidrawElementSkeleton[]

// Excalidraw 0.18 FONT_FAMILY.Helvetica. Kept local so the renderer does not
// pull the browser runtime into Node-based tests just to access an enum value.
const EXCALIDRAW_SYSTEM_FONT_FAMILY = 2

export function renderScene(structure: MindPptStructure): ExcalidrawScene {
  return [
    ...renderTreeScene(structure),
    ...structure.slides.flatMap(renderSlide),
  ]
}

function renderSlide(slide: SlideNode): ExcalidrawScene {
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
    renderContent(slide, element),
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
): ExcalidrawScene {
  if (element.kind === 'image') {
    return [{
      type: 'image',
      id: element.id,
      x: slide.x + element.x,
      y: slide.y + element.y,
      width: element.width,
      height: element.height,
      fileId: imageFileId(element.src),
      status: 'saved',
      scale: [1, 1],
    }]
  }

  if (element.kind === 'extension') {
    return renderExtensionFallback(slide, element)
  }

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
  const x = slide.x + element.x
  const y = slide.y + element.y
  const text = contentText(element)

  return [
    {
      type: 'rectangle',
      id: element.id + '/box',
      x,
      y,
      width: element.width,
      height: element.height,
      backgroundColor: '#f8f9fa',
      strokeColor: '#adb5bd',
      strokeStyle: 'dashed',
      fillStyle: 'solid',
      roughness: 0,
    },
    {
      type: 'text',
      id: element.id + '/text',
      x: x + 16,
      y: y + 16,
      text,
      fontSize: contentFontSize(element),
      fontFamily: EXCALIDRAW_SYSTEM_FONT_FAMILY,
      textAlign: 'left',
      verticalAlign: 'top',
      strokeColor: '#1b1b1f',
    },
  ]
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
  }
}
