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

export interface CameraPathOption {
  id: string
  name: string
}

export interface CameraSoftLink {
  id: string
  targetSlideId: string
}

export interface CameraView {
  slideIds: readonly string[]
  childSlideIds: readonly string[]
  pathOptions: readonly CameraPathOption[]
  outgoingSoftLinks: readonly CameraSoftLink[]
  canPathPrevious: boolean
  canPathNext: boolean
  currentSlideId?: string
  target?: CameraTarget
  parentSlideId?: string
  selectedPathId?: string
  currentPathOccurrenceIndex?: number
  currentPathOccurrenceCount?: number
  focusRequest?: CameraFocusRequest
}
