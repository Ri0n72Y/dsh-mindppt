import type { MindPptStructure } from './types.ts'

const HELLO_GRAMMAR =
  /^\s*mindppt\s+slide\s+([A-Za-z_][A-Za-z0-9_-]*)\s*\{\s*title\s+("(?:\\.|[^"\\])*")\s*\}\s*$/s

export class MindPptSyntaxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MindPptSyntaxError'
  }
}

export function compileSource(source: string): MindPptStructure {
  const match = HELLO_GRAMMAR.exec(source)
  if (!match) {
    throw new MindPptSyntaxError(
      'Expected: mindppt -> slide <id> { title "<text>" }',
    )
  }

  const [, slideId, rawTitle] = match
  if (!slideId || !rawTitle) {
    throw new MindPptSyntaxError('Missing slide id or title')
  }

  let title: string
  try {
    title = JSON.parse(rawTitle) as string
  } catch {
    throw new MindPptSyntaxError('Invalid quoted title')
  }

  return {
    version: 0,
    slides: [
      {
        id: slideId,
        x: 0,
        y: 0,
        width: 1600,
        height: 900,
        elements: [
          {
            kind: 'title',
            id: `slide:${slideId}/title:0`,
            text: title,
            x: 160,
            y: 350,
            width: 1280,
            height: 120,
          },
        ],
      },
    ],
  }
}
