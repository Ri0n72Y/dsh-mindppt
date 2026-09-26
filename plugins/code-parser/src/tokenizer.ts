import { MindPptSyntaxError } from './errors.ts'
import type { SourceRange } from './types.ts'

export type Token =
  | { kind: 'marker'; range: SourceRange }
  | { kind: 'tree-start'; direction: string; range: SourceRange }
  | { kind: 'slide-start'; id: string; range: SourceRange }
  | { kind: 'edge'; from: string; to: string; range: SourceRange }
  | { kind: 'heading'; text: string; range: SourceRange }
  | { kind: 'fence'; type: string; raw: string; range: SourceRange }
  | { kind: 'block-end'; range: SourceRange }
  | { kind: 'unknown'; text: string; range: SourceRange }

const ID = '[A-Za-z_][A-Za-z0-9_-]*'
const TREE_START = new RegExp(`^tree\\s+([A-Za-z]+)\\s*\\{$`)
const SLIDE_START = new RegExp(`^slide\\s+(${ID})\\s*\\{$`)
const EDGE = new RegExp(`^(${ID})\\s*-->\\s*(${ID})$`)

export function tokenize(source: string): Token[] {
  const lines = source.split('\n')
  const tokens: Token[] = []
  let offset = 0

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const start = offset
    const end = start + line.length
    offset = end + 1

    const text = line.trim()
    if (!text) continue

    if (text.startsWith('```')) {
      const fenceStart = start
      const type = text.slice(3).trim()
      const raw: string[] = []
      let closed = false

      while (index + 1 < lines.length) {
        index += 1
        const next = lines[index] ?? ''
        const nextStart = offset
        const nextEnd = nextStart + next.length
        offset = nextEnd + 1

        if (next.trim() === '```') {
          tokens.push({
            kind: 'fence',
            type,
            raw: raw.join('\n'),
            range: { start: fenceStart, end: nextEnd },
          })
          closed = true
          break
        }

        raw.push(next)
      }

      if (!closed) {
        throw new MindPptSyntaxError('Unclosed fenced content block')
      }
      continue
    }

    const range = { start, end }

    if (text === 'mindppt') {
      tokens.push({ kind: 'marker', range })
      continue
    }

    const tree = TREE_START.exec(text)
    if (tree?.[1]) {
      tokens.push({ kind: 'tree-start', direction: tree[1], range })
      continue
    }

    const slide = SLIDE_START.exec(text)
    if (slide?.[1]) {
      tokens.push({ kind: 'slide-start', id: slide[1], range })
      continue
    }

    const edge = EDGE.exec(text)
    if (edge?.[1] && edge[2]) {
      tokens.push({ kind: 'edge', from: edge[1], to: edge[2], range })
      continue
    }

    if (text.startsWith('# ')) {
      tokens.push({ kind: 'heading', text: text.slice(2).trim(), range })
      continue
    }

    if (text === '}') {
      tokens.push({ kind: 'block-end', range })
      continue
    }

    tokens.push({ kind: 'unknown', text, range })
  }

  return tokens
}
