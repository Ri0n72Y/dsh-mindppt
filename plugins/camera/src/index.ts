import { Service, type Context } from '@deepseek-ai/cordis'
import type {
  MindPptStructure,
  PresentationPath,
  SlideNode,
  SoftLink,
} from 'dsh-mindppt-code-parser'

import type {
  CameraFocusRequest,
  CameraTarget,
  CameraView,
} from './types.ts'

export type {
  CameraFocusRequest,
  CameraPathOption,
  CameraSoftLink,
  CameraTarget,
  CameraView,
} from './types.ts'

export const serviceName = 'mindpptCamera' as const

declare module '@deepseek-ai/cordis' {
  interface Context {
    mindpptCamera: MindPptCameraService
  }
}

export default class MindPptCameraService extends Service {
  static inject = ['mindpptParser']

  private structure: MindPptStructure | undefined
  private activeSlideId: string | undefined
  private selectedPathId: string | undefined
  private pathIndex: number | undefined
  private revision = 0
  private request: CameraFocusRequest | undefined

  constructor(ctx: Context) {
    super(ctx, serviceName)
    this.structure = ctx.mindpptParser.structure
    ctx.on('mindppt/compiled', (structure) => this.acceptStructure(structure))
  }

  get currentSlideId(): string | undefined {
    return this.activeSlideId
  }

  get view(): CameraView {
    const current = this.activeSlideId
    const slide = current ? this.findSlide(current) : undefined
    const parent = current ? this.findParent(current) : undefined
    const path = this.findPath(this.selectedPathId)
    const index = this.pathIndex

    return {
      slideIds: this.structure?.slides.map(({ id }) => id) ?? [],
      childSlideIds: current ? this.findChildren(current) : [],
      pathOptions: this.structure?.paths?.map(({ id, name }) => ({
        id,
        name,
      })) ?? [],
      outgoingSoftLinks: current
        ? this.findOutgoingLinks(current).map(({ id, toSlideId }) => ({
            id,
            targetSlideId: toSlideId,
          }))
        : [],
      canPathPrevious: Boolean(path && index !== undefined && index > 0),
      canPathNext: Boolean(
        path && index !== undefined && index + 1 < path.occurrences.length,
      ),
      ...(current ? { currentSlideId: current } : {}),
      ...(slide ? { target: toCameraTarget(slide) } : {}),
      ...(parent ? { parentSlideId: parent } : {}),
      ...(path ? { selectedPathId: path.id } : {}),
      ...(path && index !== undefined
        ? {
            currentPathOccurrenceIndex: index,
            currentPathOccurrenceCount: path.occurrences.length,
          }
        : {}),
      ...(this.request ? { focusRequest: this.request } : {}),
    }
  }

  focusSlide(slideId: string): boolean {
    if (!this.findSlide(slideId)) return false
    this.clearPath()
    return this.issueFocus(slideId)
  }

  focusParent(): boolean {
    const current = this.activeSlideId
    const parent = current ? this.findParent(current) : undefined
    return parent ? this.focusSlide(parent) : false
  }

  focusChild(slideId: string): boolean {
    const current = this.activeSlideId
    if (!current || !this.findChildren(current).includes(slideId)) return false
    return this.focusSlide(slideId)
  }

  selectPath(pathId: string): boolean {
    const path = this.findPath(pathId)
    return path ? this.focusPathOccurrence(path, 0) : false
  }

  pathNext(): boolean {
    const path = this.findPath(this.selectedPathId)
    const index = this.pathIndex
    return path && index !== undefined
      ? this.focusPathOccurrence(path, index + 1)
      : false
  }

  pathPrevious(): boolean {
    const path = this.findPath(this.selectedPathId)
    const index = this.pathIndex
    return path && index !== undefined && index > 0
      ? this.focusPathOccurrence(path, index - 1)
      : false
  }

  followSoftLink(linkId: string): boolean {
    const current = this.activeSlideId
    if (!current) return false

    const link = this.findOutgoingLinks(current).find(({ id }) => id === linkId)
    return link ? this.focusSlide(link.toSlideId) : false
  }

  private focusPathOccurrence(path: PresentationPath, index: number): boolean {
    const occurrence = path.occurrences[index]
    if (!occurrence || !this.findSlide(occurrence.slideId)) return false

    this.selectedPathId = path.id
    this.pathIndex = index
    return this.issueFocus(occurrence.slideId)
  }

  private issueFocus(slideId: string): boolean {
    if (!this.findSlide(slideId)) return false

    const fromSlideId = this.activeSlideId
    this.activeSlideId = slideId
    this.revision += 1
    this.request = {
      revision: this.revision,
      slideId,
      ...(fromSlideId !== undefined ? { fromSlideId } : {}),
    }
    return true
  }

  private acceptStructure(structure: MindPptStructure): void {
    this.structure = structure

    if (!this.activeSlideId) {
      this.clearPath()
      return
    }

    if (!this.findSlide(this.activeSlideId)) {
      this.activeSlideId = undefined
      this.request = undefined
      this.clearPath()
      return
    }

    const path = this.findPath(this.selectedPathId)
    const occurrence = path && this.pathIndex !== undefined
      ? path.occurrences[this.pathIndex]
      : undefined

    if (!occurrence || occurrence.slideId !== this.activeSlideId) {
      this.clearPath()
    }
  }

  private clearPath(): void {
    this.selectedPathId = undefined
    this.pathIndex = undefined
  }

  private findSlide(slideId: string): SlideNode | undefined {
    return this.structure?.slides.find(({ id }) => id === slideId)
  }

  private findPath(pathId?: string): PresentationPath | undefined {
    return pathId
      ? this.structure?.paths?.find(({ id }) => id === pathId)
      : undefined
  }

  private findParent(slideId: string): string | undefined {
    return this.structure?.tree?.edges.find(({ to }) => to === slideId)?.from
  }

  private findChildren(slideId: string): string[] {
    return this.structure?.tree?.edges
      .filter(({ from }) => from === slideId)
      .map(({ to }) => to) ?? []
  }

  private findOutgoingLinks(slideId: string): SoftLink[] {
    return this.structure?.links?.filter(
      ({ fromSlideId }) => fromSlideId === slideId,
    ) ?? []
  }
}

function toCameraTarget(slide: SlideNode): CameraTarget {
  return {
    slideId: slide.id,
    x: slide.x,
    y: slide.y,
    width: slide.width,
    height: slide.height,
  }
}
