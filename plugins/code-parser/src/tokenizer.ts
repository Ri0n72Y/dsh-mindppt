import { MindPptCompileError } from './errors.ts'
import type { SourceRange } from './types.ts'

export type Token =
  | { kind: 'marker'; range: SourceRange }
  | { kind: 'tree-start'; direction: string; range: SourceRange }
  | { kind: 'slide-start'; id: string; range: SourceRange }
  | { kind: 'edge'; from: string; to: string; text: string; range: SourceRange }
  | { kind: 'heading'; level: 1 | 2; text: string; range: SourceRange }
  | { kind: 'list-item'; ordered: boolean; text: string; range: SourceRange }
  | { kind: 'text'; text: string; range: SourceRange }
  | { kind: 'fence'; type: string; raw: string; range: SourceRange }
  | { kind: 'blank'; range: SourceRange }
  | { kind: 'block-end'; range: SourceRange }

const ID = '[A-Za-z_][A-Za-z0-9_-]*'
const TREE_START = new RegExp(`^tree\\s+([A-Za-z]+)\\s*\\{$`)
const SLIDE_START = new RegExp(`^slide\\s+(${ID})\\s*\\{$`)
const EDGE = new RegExp(`^(${ID})\\s*-->\\s*(${ID})$`)
const HEADING = /^(#{1,2})\s+(.+)$/
const UNORDERED_ITEM = /^-\s+(.+)$/
const ORDERED_ITEM = /^\d+\.\s+(.+)$/

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
    const range = { start, end }

    if (!text) {
      tokens.push({ kind: 'blank', range })
      continue
    }

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
        throw new MindPptCompileError('Unclosed fenced content block')
      }
      continue
    }

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
      tokens.push({ kind: 'edge', from: edge[1], to: edge[2], text, range })
      continue
    }

    if (text === '}') {
      tokens.push({ kind: 'block-end', range })
      continue
    }

    const heading = HEADING.exec(text)
    if (heading?.[1] && heading[2]) {
      tokens.push({
        kind: 'heading',
        level: heading[1].length as 1 | 2,
        text: heading[2].trim(),
        range,
      })
      continue
    }

    const unordered = UNORDERED_ITEM.exec(text)
    if (unordered?.[1]) {
      tokens.push({
        kind: 'list-item',
        ordered: false,
        text: unordered[1],
        range,
      })
      continue
    }

    const ordered = ORDERED_ITEM.exec(text)
    if (ordered?.[1]) {
      tokens.push({
        kind: 'list-item',
        ordered: true,
        text: ordered[1],
        range,
      })
      continue
    }

    tokens.push({ kind: 'text', text, range })
  }

  return tokens
}
