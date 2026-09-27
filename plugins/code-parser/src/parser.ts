import { MindPptCompileError } from './errors.ts'
import type { Token } from './tokenizer.ts'
import type { SourceRange } from './types.ts'

export type ParsedContent =
  | {
      kind: 'title' | 'subtitle' | 'text'
      text: string
      range: SourceRange
    }
  | {
      kind: 'list'
      ordered: boolean
      items: string[]
      range: SourceRange
    }
  | {
      kind: 'extension'
      type: string
      raw: string
      range: SourceRange
    }

export interface ParsedSlide {
  id: string
  content: ParsedContent[]
  range: SourceRange
}

export interface ParsedTreeEdge {
  from: string
  to: string
  range: SourceRange
}

export interface ParsedTree {
  direction: 'LR'
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
        if (tree) this.fail('M2 supports one primary tree')
        tree = this.parseTree()
        continue
      }

      if (token.kind === 'slide-start') {
        slides.push(this.parseSlide())
        continue
      }

      this.fail(`Unexpected document statement: ${describe(token)}`)
    }

    return tree ? { slides, tree } : { slides }
  }

  private parseTree(): ParsedTree {
    const start = this.expect('tree-start')
    if (start.direction !== 'LR') {
      this.fail('M2 supports tree direction LR only')
    }

    const edges: ParsedTreeEdge[] = []
    while (true) {
      this.skipBlanks()
      if (this.current()?.kind === 'block-end') break
      const edge = this.expect('edge')
      edges.push({ from: edge.from, to: edge.to, range: edge.range })
    }

    const end = this.expect('block-end')
    if (edges.length === 0) this.fail('Tree must contain at least one edge')

    return {
      direction: 'LR',
      edges,
      range: { start: start.range.start, end: end.range.end },
    }
  }

  private parseSlide(): ParsedSlide {
    const start = this.expect('slide-start')
    const content: ParsedContent[] = []
    let titles = 0

    while (true) {
      this.skipBlanks()
      const token = this.current()
      if (!token) this.fail(`Unclosed slide "${start.id}"`)
      if (token.kind === 'block-end') break

      if (token.kind === 'heading') {
        const kind = token.level === 1 ? 'title' : 'subtitle'
        if (kind === 'title' && ++titles > 1) {
          this.fail(`Slide "${start.id}" supports one # heading`)
        }
        content.push({ kind, text: token.text, range: token.range })
        this.index += 1
        continue
      }

      if (token.kind === 'text') {
        content.push(this.parseParagraph())
        continue
      }

      if (token.kind === 'list-item') {
        content.push(this.parseList(token.ordered))
        continue
      }

      if (token.kind === 'fence') {
        content.push({
          kind: 'extension',
          type: token.type,
          raw: token.raw,
          range: token.range,
        })
        this.index += 1
        continue
      }

      this.fail(`Unsupported slide content: ${describe(token)}`)
    }

    const end = this.expect('block-end')
    if (titles === 0) this.fail(`Slide "${start.id}" requires one # heading`)

    return {
      id: start.id,
      content,
      range: { start: start.range.start, end: end.range.end },
    }
  }

  private parseParagraph(): ParsedContent {
    const first = this.expect('text')
    const lines = [first.text]
    let end = first.range.end

    while (this.current()?.kind === 'text') {
      const line = this.expect('text')
      lines.push(line.text)
      end = line.range.end
    }

    return {
      kind: 'text',
      text: lines.join(' '),
      range: { start: first.range.start, end },
    }
  }

  private parseList(ordered: boolean): ParsedContent {
    const first = this.expect('list-item')
    const items = [first.text]
    let end = first.range.end

    while (true) {
      const token = this.current()
      if (token?.kind !== 'list-item' || token.ordered !== ordered) break

      const item = this.expect('list-item')
      items.push(item.text)
      end = item.range.end
    }

    return {
      kind: 'list',
      ordered,
      items,
      range: { start: first.range.start, end },
    }
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
      this.fail(`Expected ${kind}, received ${describe(token)}`)
    }

    this.index += 1
    return token as Extract<Token, { kind: K }>
  }

  private fail(message: string): never {
    throw new MindPptCompileError(message)
  }
}

function describe(token: Token | undefined): string {
  return token?.kind ?? 'end of source'
}
