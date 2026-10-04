import { MindPptCompileError } from './errors.ts'
import type {
  ParsedPresentationPath,
  ParsedSoftLink,
} from './parsed-types.ts'
import type {
  PresentationPath,
  SoftLink,
} from './types.ts'

export function resolveSoftLinks(
  parsedLinks: ParsedSoftLink[],
  slideIds: Set<string>,
): SoftLink[] {
  const links: SoftLink[] = []
  const identities = new Set<string>()

  for (const link of parsedLinks) {
    if (!slideIds.has(link.fromSlideId)) {
      throw new MindPptCompileError(
        'Unknown SoftLink source slide: ' + link.fromSlideId,
        link.range,
      )
    }
    if (!slideIds.has(link.toSlideId)) {
      throw new MindPptCompileError(
        'Unknown SoftLink target slide: ' + link.toSlideId,
        link.range,
      )
    }
    if (link.fromSlideId === link.toSlideId) {
      throw new MindPptCompileError(
        'SoftLink cannot target its source slide: ' + link.fromSlideId,
        link.range,
      )
    }

    const id = 'link:' + link.fromSlideId + '->' + link.toSlideId
    if (identities.has(id)) {
      throw new MindPptCompileError(
        'Duplicate SoftLink: '
          + link.fromSlideId
          + ' -.-> '
          + link.toSlideId,
        link.range,
      )
    }

    identities.add(id)
    links.push({
      id,
      fromSlideId: link.fromSlideId,
      toSlideId: link.toSlideId,
      sourceRange: link.range,
    })
  }

  return links
}

export function resolvePresentationPaths(
  parsedPaths: ParsedPresentationPath[],
  slideIds: Set<string>,
): PresentationPath[] {
  const paths: PresentationPath[] = []
  const names = new Set<string>()

  for (const path of parsedPaths) {
    if (names.has(path.name)) {
      throw new MindPptCompileError(
        'Duplicate PresentationPath: ' + path.name,
        path.range,
      )
    }
    names.add(path.name)

    if (!path.occurrences.length) {
      throw new MindPptCompileError(
        'PresentationPath "' + path.name + '" must not be empty',
        path.range,
      )
    }

    const id = 'path:' + path.name
    const occurrences = path.occurrences.map((occurrence, index) => {
      if (!slideIds.has(occurrence.slideId)) {
        throw new MindPptCompileError(
          'Unknown slide in PresentationPath "'
            + path.name
            + '": '
            + occurrence.slideId,
          occurrence.range,
        )
      }

      return {
        id: id + '/occurrence:' + index,
        slideId: occurrence.slideId,
        sourceRange: occurrence.range,
      }
    })

    paths.push({
      id,
      name: path.name,
      occurrences,
      sourceRange: path.range,
    })
  }

  return paths
}
