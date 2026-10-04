import { readFileSync } from 'node:fs'

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService from 'dsh-mindppt-code-parser'
import MindPptCanvasService from '../src/index.ts'

const M8 = readFileSync(
  new URL(
    '../../../examples/m8-soft-links-presentation-paths.mindppt',
    import.meta.url,
  ),
  'utf8',
).replace(/\r\n/g, '\n')

describe('M8 SoftLink Excalidraw lowering', () => {
  it('renders one deterministic dashed directed relation and no path topology', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)

    await ctx.plugin({
      name: 'mindppt-m8-render-test',
      inject: ['mindpptParser', 'mindpptCanvas'],
      apply(child: Context) {
        const structure = child.mindpptParser.compile(M8)
        const positions = structure.slides.map(({ id, x, y }) => [id, x, y])
        const first = child.mindpptCanvas.scene

        child.mindpptParser.compile(M8)
        const second = child.mindpptCanvas.scene
        expect(second).toEqual(first)

        const arrows = first.filter((element) => element.type === 'arrow')
        expect(arrows).toHaveLength((structure.tree?.edges.length ?? 0) + 1)

        const link = arrows.find(
          (element) => element.id === 'link:customer->summary',
        )
        expect(link).toEqual(expect.objectContaining({
          type: 'arrow',
          strokeStyle: 'dashed',
          strokeWidth: 2,
          endArrowhead: 'arrow',
          roughness: 0,
        }))
        expect(first.find(
          (element) => element.id === 'tree:hero->agenda',
        )).not.toEqual(expect.objectContaining({ strokeStyle: 'dashed' }))

        if (!link || link.type !== 'arrow') return
        expect([
          link.x,
          link.y,
          ...(link.points?.flat() ?? []),
        ].every(Number.isFinite)).toBe(true)
        expect(structure.slides.map(({ id, x, y }) => [id, x, y]))
          .toEqual(positions)
      },
    })
  })

  it('renders reverse SoftLinks as independent directed primitives', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)
    const source = `mindppt

tree LR {
  a --> b
}

link a -.-> b
link b -.-> a

slide a {
  # A
}

slide b {
  # B
}
`

    await ctx.plugin({
      name: 'mindppt-m8-reverse-render-test',
      inject: ['mindpptParser', 'mindpptCanvas'],
      apply(child: Context) {
        child.mindpptParser.compile(source)
        const links = child.mindpptCanvas.scene.filter(
          (element) => element.type === 'arrow'
            && element.id?.startsWith('link:'),
        )

        expect(links.map(({ id }) => id)).toEqual([
          'link:a->b',
          'link:b->a',
        ])
      },
    })
  })
})
