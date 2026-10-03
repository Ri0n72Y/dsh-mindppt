import { MindPptCompileError } from './errors.ts'
import type { ParsedSlide, ParsedTreeEdge } from './parsed-types.ts'
import type { MindPptDiagnostic, TreeEdge } from './types.ts'

export interface ValidatedPrimaryTree {
  edges: TreeEdge[]
  warnings: MindPptDiagnostic[]
}

export function validateSlideIds(slides: ParsedSlide[]): Set<string> {
  const slideIds = new Set<string>()

  for (const slide of slides) {
    if (slideIds.has(slide.id)) {
      throw new MindPptCompileError(
        `Duplicate slide ID: ${slide.id}`,
        slide.range,
      )
    }
    slideIds.add(slide.id)
  }

  return slideIds
}

export function validatePrimaryTree(
  slides: ParsedSlide[],
  parsedEdges: ParsedTreeEdge[],
  slideIds: Set<string>,
): ValidatedPrimaryTree {
  const edges: TreeEdge[] = []
  const edgeIds = new Set<string>()
  const parentByChild = new Map<string, string>()

  for (const edge of parsedEdges) {
    if (!slideIds.has(edge.from) || !slideIds.has(edge.to)) {
      throw new MindPptCompileError(
        `Unknown slide in tree edge: ${edge.from} --> ${edge.to}`,
        edge.range,
      )
    }

    const id = `tree:${edge.from}->${edge.to}`
    if (edgeIds.has(id)) {
      throw new MindPptCompileError(
        `Duplicate tree edge: ${edge.from} --> ${edge.to}`,
        edge.range,
      )
    }
    edgeIds.add(id)

    const existingParent = parentByChild.get(edge.to)
    if (existingParent && existingParent !== edge.from) {
      throw new MindPptCompileError(
        `Slide "${edge.to}" has multiple parents: "${existingParent}" and "${edge.from}"`,
        edge.range,
      )
    }
    parentByChild.set(edge.to, edge.from)

    edges.push({
      id,
      from: edge.from,
      to: edge.to,
      sourceRange: edge.range,
    })
  }

  assertAcyclic(slideIds, edges)

  return {
    edges,
    warnings: unreachableWarnings(slides, edges, parentByChild),
  }
}

function assertAcyclic(slideIds: Set<string>, edges: TreeEdge[]): void {
  const outgoing = new Map<string, TreeEdge[]>()
  for (const edge of edges) {
    const next = outgoing.get(edge.from) ?? []
    next.push(edge)
    outgoing.set(edge.from, next)
  }

  const state = new Map<string, 'visiting' | 'done'>()

  const visit = (slideId: string): void => {
    state.set(slideId, 'visiting')

    for (const edge of outgoing.get(slideId) ?? []) {
      if (state.get(edge.to) === 'visiting') {
        throw new MindPptCompileError(
          `Primary tree contains a cycle through ${edge.from} --> ${edge.to}`,
          edge.sourceRange,
        )
      }

      if (state.get(edge.to) !== 'done') visit(edge.to)
    }

    state.set(slideId, 'done')
  }

  for (const slideId of slideIds) {
    if (!state.has(slideId)) visit(slideId)
  }
}

function unreachableWarnings(
  slides: ParsedSlide[],
  edges: TreeEdge[],
  parentByChild: Map<string, string>,
): MindPptDiagnostic[] {
  const rootId = edges.find((edge) => !parentByChild.has(edge.from))?.from
  if (!rootId) return []

  const root = slides.find((slide) => slide.id === rootId)
  if (!root) return []

  const children = new Map<string, string[]>()
  for (const edge of edges) {
    const next = children.get(edge.from) ?? []
    next.push(edge.to)
    children.set(edge.from, next)
  }

  const reachable = new Set<string>()
  const pending = [root.id]

  while (pending.length) {
    const slideId = pending.pop()
    if (!slideId || reachable.has(slideId)) continue
    reachable.add(slideId)
    pending.push(...(children.get(slideId) ?? []))
  }

  return slides
    .filter((slide) => !reachable.has(slide.id))
    .map((slide) => ({
      severity: 'warning' as const,
      message: `Slide "${slide.id}" is unreachable from primary tree root "${root.id}"`,
      sourceRange: slide.range,
    }))
}
