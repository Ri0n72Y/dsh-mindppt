import { describe, expect, it } from 'vitest'

import { tokenize } from '../src/tokenizer.ts'

describe('tokenize', () => {
  it('keeps fenced content opaque to structural tokenization', () => {
    const source = `mindppt

slide demo {
  # Demo

  \`\`\`latex
  f(x) = { x | x > 0 }
  A --> B
  link A -.-> B
  path main {
  \`\`\`
}
`

    const tokens = tokenize(source)
    const fence = tokens.find((token) => token.kind === 'fence')

    expect(fence).toEqual(expect.objectContaining({
      kind: 'fence',
      type: 'latex',
      raw: '  f(x) = { x | x > 0 }\n  A --> B'
        + '\n  link A -.-> B\n  path main {',
    }))

    expect(tokens.filter((token) => token.kind === 'edge')).toHaveLength(0)
    expect(tokens.filter((token) => token.kind === 'soft-link')).toHaveLength(0)
    expect(tokens.filter((token) => token.kind === 'path-start')).toHaveLength(0)
    expect(tokens.filter((token) => token.kind === 'block-end')).toHaveLength(1)
  })
})
