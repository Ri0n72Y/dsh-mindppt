import type { MindPptStructure } from './types.ts'

const HELLO_GRAMMAR =
  /^\s*mindppt\s+slide\s+([A-Za-z_][A-Za-z0-9_-]*)\s*\{\s*title\s+("(?:\\.|[^"\\])*")\s*\}\s*$/s

export class MindPptSyntaxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MindPptSyntaxError'
  }
}

/**
 * The first vertical slice intentionally recognizes only one slide containing
 * one title. Later milestones replace this implementation without changing
 * the Cordis service contract.
 */
export function compileHelloWorld(source: string): MindPptStructure {
  const match = HELLO_GRAMMAR.exec(source)
  if (!match) {
    throw new MindPptSyntaxError(
      'Hello-world grammar expects: mindppt -> slide <id> { title "<text>" }',
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

  const slideStart = source.indexOf('slide')
  const titleStart = source.indexOf('title', slideStart)

  return {
    version: 0,
    slides: [
      {
        id: slideId,
        x: 0,
        y: 0,
        width: 1600,
        height: 900,
        sourceRange: { start: slideStart, end: source.length },
        elements: [
          {
            kind: 'title',
            id: `slide:${slideId}/title:0`,
            text: title,
            x: 160,
            y: 350,
            width: 1280,
            height: 120,
            sourceRange: {
              start: titleStart,
              end: titleStart + 'title'.length + 1 + rawTitle.length,
            },
          },
        ],
      },
    ],
  }
}
