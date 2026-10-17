import { Context } from '@deepseek-ai/cordis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import MindPptParserService, { type ImageNode } from 'dsh-mindppt-code-parser'
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import { containImages } from '../src/image-contain.ts'

const source = 'mindppt\nslide asset {\n  layout two-column\n  # Photo\n  left {\n    ![P](./p.svg)\n  }\n}\n'
const ctx = new Context()
let semantic!: ImageNode

beforeAll(async () => {
  await ctx.plugin(MindPptParserService)
  await ctx.plugin({
    name: 'mindppt-image-contain-test',
    inject: ['mindpptParser'],
    apply(child: Context) {
      semantic = child.mindpptParser.compile(source).slides[0]!
        .elements.find((element): element is ImageNode => element.kind === 'image')!
    },
  })
})

afterAll(async () => {
  await ctx.fiber.dispose()
})

function image(): ExcalidrawElementSkeleton {
  return {
    type: 'image',
    id: semantic.id,
    x: semantic.x,
    y: semantic.y,
    width: semantic.width,
    height: semantic.height,
    fileId: 'test-file' as never,
    status: 'saved',
    scale: [1, 1],
  }
}

describe('P3a contained image projection', () => {
  it.each([
    [240, 420, 222.857142857, 390, 244.571428571, 176],
    [800, 600, 520, 390, 96, 176],
    [1200, 300, 520, 130, 96, 306],
    [400, 400, 390, 390, 161, 176],
  ])('centers %s×%s images with no stretch or crop', (
    sourceW, sourceH, width, height, x, y,
  ) => {
    const original = image()
    const scene = containImages([original], {
      [semantic.id]: { width: sourceW, height: sourceH },
    })
    const fitted = scene[0]!
    expect(fitted).toMatchObject({
      id: original.id, fileId: 'test-file', scale: [1, 1],
    })
    expect(fitted.x).toBeCloseTo(x, 5)
    expect(fitted.y).toBeCloseTo(y, 5)
    expect(fitted.width).toBeCloseTo(width, 5)
    expect(fitted.height).toBeCloseTo(height, 5)
    if (fitted.width === undefined || fitted.height === undefined) {
      throw new Error('Contained image must have concrete dimensions')
    }
    expect(fitted.width / fitted.height).toBeCloseTo(sourceW / sourceH, 8)
    expect(semantic).toMatchObject({
      id: 'slide:asset/left/image:0',
      x: 96, y: 176, width: 520, height: 390,
      sourceRange: expect.any(Object),
    })
    expect(source.slice(semantic.sourceRange.start, semantic.sourceRange.end))
      .toBe('    ![P](./p.svg)')
  })

  it('leaves unresolved/invalid images alone and keeps non-image children', () => {
    const original = image()
    const other = { type: 'rectangle', id: 'other', x: 1, y: 2, width: 3, height: 4 } as ExcalidrawElementSkeleton
    expect(containImages([original, other], {})).toEqual([original, other])
    for (const width of [0, NaN, Infinity, -10]) {
      expect(containImages([original], {
        [semantic.id]: { width, height: 200 },
      })[0]).toEqual(original)
    }
    expect(semantic.x + semantic.width).toBe(616)
  })
})
