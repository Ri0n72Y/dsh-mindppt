import { parseSlideContent, type ParsedContent } from './content-parser.ts'
import { MindPptCompileError } from './errors.ts'
import type { Token } from './tokenizer.ts'
import type {
  LayoutPreset,
  LayoutSlot,
  SourceRange,
  TreeDirection,
} from './types.ts'

export interface ParsedSlide {
  id: string
  layout?: LayoutPreset
  content: ParsedContent[]
  slots: Partial<Record<LayoutSlot, ParsedContent[]>>
  range: SourceRange
}

export interface ParsedTreeEdge {
  from: string
  to: string
  range: SourceRange
}

export interface ParsedTree {
  direction: TreeDirection
  edges: ParsedTreeEdge[]
  range: SourceRange
}

export interface ParsedDocument {
  slides: ParsedSlide[]
  tree?: ParsedTree
}

export function parse(tokens: Token[]): ParsedDocument {
  return new Parser(tokens).parseDocument()
}

class Parser {
  private index = 0

  constructor(private readonly tokens: Token[]) {}

  parseDocument(): ParsedDocument {
    this.skipBlanks()
    this.expect('marker')

    const slides: ParsedSlide[] = []
    let tree: ParsedTree | undefined

    while (this.current()) {
      this.skipBlanks()
      const token = this.current()
      if (!token) break

      if (token.kind === 'tree-start') {
        if (tree) this.fail('MindPPT supports one primary tree')
        tree = this.parseTree()
        continue
      }

      if (token.kind === 'slide-start') {
        slides.push(this.parseSlide())
        continue
      }

      this.fail('Unexpected document statement: ' + token.kind)
    }

    return tree ? { slides, tree } : { slides }
  }

  private parseTree(): ParsedTree {
    const start = this.expect('tree-start')
    if (!isTreeDirection(start.direction)) {
      this.fail('Unsupported tree direction: ' + start.direction, start.range)
    }

    const edges: ParsedTreeEdge[] = []
    while (true) {
      this.skipBlanks()
      if (this.current()?.kind === 'block-end') break
      const edge = this.expect('edge')
      edges.push({ from: edge.from, to: edge.to, range: edge.range })
    }

    const end = this.expect('block-end')
    if (edges.length === 0) {
      this.fail(
        'Tree must contain at least one edge',
        { start: start.range.start, end: end.range.end },
      )
    }

    return {
      direction: start.direction,
      edges,
      range: { start: start.range.start, end: end.range.end },
    }
  }

  private parseSlide(): ParsedSlide {
    const start = this.expect('slide-start')
    const body: Token[] = []
    const slots: Partial<Record<LayoutSlot, ParsedContent[]>> = {}
    let layout: LayoutPreset | undefined

    while (this.current() && this.current()?.kind !== 'block-end') {
      const token = this.current()
      if (!token) break

      if (token.kind === 'layout') {
        if (layout) this.fail('Slide "' + start.id + '" has duplicate layout', token.range)
        if (!isLayoutPreset(token.preset)) {
          this.fail('Unsupported layout preset: ' + token.preset, token.range)
        }
        layout = token.preset
        this.index += 1
        continue
      }

      if (token.kind === 'slot-start') {
        if (layout !== 'two-column') {
          this.fail(
            'Slide "' + start.id + '" named slots require layout two-column',
            token.range,
          )
        }
        if (slots[token.name]) {
          this.fail(
            'Slide "' + start.id + '" has duplicate ' + token.name + ' slot',
            token.range,
          )
        }

        const slot = this.parseSlot()
        slots[slot.name] = parseSlideContent(slot.body, start.id)
        continue
      }

      body.push(token)
      this.index += 1
    }

    const end = this.expect('block-end')
    const slide: ParsedSlide = {
      id: start.id,
      content: parseSlideContent(body, start.id),
      slots,
      range: { start: start.range.start, end: end.range.end },
    }
    if (layout) slide.layout = layout
    return slide
  }

  private parseSlot(): { name: LayoutSlot; body: Token[] } {
    const start = this.expect('slot-start')
    const body: Token[] = []

    while (this.current() && this.current()?.kind !== 'block-end') {
      const token = this.current()
      if (token) body.push(token)
      this.index += 1
    }

    this.expect('block-end')
    return { name: start.name, body }
  }

  private skipBlanks(): void {
    while (this.current()?.kind === 'blank') this.index += 1
  }

  private current(): Token | undefined {
    return this.tokens[this.index]
  }

  private expect<K extends Token['kind']>(
    kind: K,
  ): Extract<Token, { kind: K }> {
    const token = this.current()
    if (token?.kind !== kind) {
      this.fail('Expected ' + kind + ', received ' + (token?.kind ?? 'end of source'))
    }

    this.index += 1
    return token as Extract<Token, { kind: K }>
  }

  private fail(message: string, sourceRange?: SourceRange): never {
    const current = this.current()?.range
    const previous = this.tokens[this.index - 1]?.range
    const resolvedRange = sourceRange ?? current ?? (
      previous
        ? { start: previous.end, end: previous.end }
        : undefined
    )

    throw new MindPptCompileError(message, resolvedRange)
  }
}

function isTreeDirection(direction: string): direction is TreeDirection {
  return direction === 'LR'
    || direction === 'RL'
    || direction === 'TB'
    || direction === 'TD'
    || direction === 'BT'
}

function isLayoutPreset(preset: string): preset is LayoutPreset {
  return preset === 'two-column'
}
