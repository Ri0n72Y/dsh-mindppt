import { Service, type Context } from '@deepseek-ai/cordis'
import type {
  MindPptStructure,
  SlideNode,
} from 'dsh-mindppt-code-parser'

export const serviceName = 'mindpptCamera' as const

export interface CameraTarget {
  slideId: string
  x: number
  y: number
  width: number
  height: number
}

export interface CameraFocusRequest {
  revision: number
  slideId: string
  fromSlideId?: string
}

export interface CameraView {
  slideIds: readonly string[]
  childSlideIds: readonly string[]
  currentSlideId?: string
  target?: CameraTarget
  parentSlideId?: string
  focusRequest?: CameraFocusRequest
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    mindpptCamera: MindPptCameraService
  }
}

export default class MindPptCameraService extends Service {
  static inject = ['mindpptParser']

  private structure: MindPptStructure | undefined
  private activeSlideId: string | undefined
  private revision = 0
  private request: CameraFocusRequest | undefined

  constructor(ctx: Context) {
    super(ctx, serviceName)

    this.structure = ctx.mindpptParser.structure

    ctx.on('mindppt/compiled', (structure) => {
      this.acceptStructure(structure)
    })
  }

  get currentSlideId(): string | undefined {
    return this.activeSlideId
  }

  get view(): CameraView {
    const currentSlideId = this.activeSlideId
    const slide = currentSlideId
      ? this.findSlide(currentSlideId)
      : undefined
    const parentSlideId = currentSlideId
      ? this.findParent(currentSlideId)
      : undefined

    return {
      slideIds: this.structure?.slides.map(({ id }) => id) ?? [],
      childSlideIds: currentSlideId
        ? this.findChildren(currentSlideId)
        : [],
      ...(currentSlideId ? { currentSlideId } : {}),
      ...(slide ? { target: toCameraTarget(slide) } : {}),
      ...(parentSlideId ? { parentSlideId } : {}),
      ...(this.request ? { focusRequest: this.request } : {}),
    }
  }

  focusSlide(slideId: string): boolean {
    const slide = this.findSlide(slideId)
    if (!slide) return false

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

  focusParent(): boolean {
    const currentSlideId = this.activeSlideId
    if (!currentSlideId) return false

    const parentSlideId = this.findParent(currentSlideId)
    return parentSlideId ? this.focusSlide(parentSlideId) : false
  }

  focusChild(slideId: string): boolean {
    const currentSlideId = this.activeSlideId
    if (!currentSlideId) return false
    if (!this.findChildren(currentSlideId).includes(slideId)) return false

    return this.focusSlide(slideId)
  }

  private acceptStructure(structure: MindPptStructure): void {
    this.structure = structure

    if (
      this.activeSlideId
      && !structure.slides.some(({ id }) => id === this.activeSlideId)
    ) {
      this.activeSlideId = undefined
      this.request = undefined
    }
  }

  private findSlide(slideId: string): SlideNode | undefined {
    return this.structure?.slides.find(({ id }) => id === slideId)
  }

  private findParent(slideId: string): string | undefined {
    return this.structure?.tree?.edges.find(({ to }) => to === slideId)?.from
  }

  private findChildren(slideId: string): string[] {
    return this.structure?.tree?.edges
      .filter(({ from }) => from === slideId)
      .map(({ to }) => to) ?? []
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
