import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types'

export interface CanvasFocusRequest {
  revision: number
  slideId: string
  fromSlideId?: string
}

export interface CameraTransitionController {
  cancel(): void
  reconcileScene(): void
}

export const CAMERA_TARGET_ZOOM_FACTOR = 0.85
export const CAMERA_ZOOM_OUT_FACTOR = 0.55
export const CAMERA_ZOOM_OUT_DURATION = 220
export const CAMERA_TRAVEL_DURATION = 340
export const CAMERA_ZOOM_IN_DURATION = 220

export function replaceMountedFiles(
  api: ExcalidrawImperativeAPI,
  files: BinaryFiles,
): void {
  const mounted = api.getFiles()
  for (const fileId of Object.keys(mounted)) {
    if (!(fileId in files)) delete mounted[fileId]
  }
  api.addFiles(Object.values(files))
}

interface Viewport {
  x: number
  y: number
  zoom: number
}

interface Motion {
  from: Viewport
  to: Viewport
  duration: number
  zoomDip: number
  elapsed: number
  startedAt?: number
}

function actualViewport(api: ExcalidrawImperativeAPI): Viewport {
  const state = api.getAppState()
  return {
    x: state.width / (2 * state.zoom.value) - state.scrollX,
    y: state.height / (2 * state.zoom.value) - state.scrollY,
    zoom: state.zoom.value,
  }
}

function targetViewport(
  api: ExcalidrawImperativeAPI,
  slideId: string,
): Viewport | undefined {
  const surface = api.getSceneElements().find(
    element => element.id === 'slide:' + slideId + '/surface',
  )
  if (!surface || surface.width <= 0 || surface.height <= 0) return undefined
  const { width, height } = api.getAppState()
  if (width <= 0 || height <= 0) return undefined

  // Match Excalidraw 0.18 fit-to-viewport normalization for a slide surface.
  const fit = Math.min(width / surface.width, height / surface.height)
    * CAMERA_TARGET_ZOOM_FACTOR
  const zoom = Math.max(0.1, Math.min(30, Math.floor(fit / 0.1 + 1e-8) * 0.1))
  return {
    x: surface.x + surface.width / 2,
    y: surface.y + surface.height / 2,
    zoom,
  }
}

function smoothstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function runCameraTransition(
  api: ExcalidrawImperativeAPI,
  request: CanvasFocusRequest,
): CameraTransitionController {
  let frame: number | undefined
  let motion: Motion | undefined

  const cancel = () => {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    if (motion) api.updateScene({ appState: { shouldCacheIgnoreZoom: false } })
    motion = undefined
  }

  const animate = (time: number) => {
    frame = undefined
    const current = motion
    if (!current) return

    if (current.startedAt === undefined) current.startedAt = time
    current.elapsed = Math.min(current.duration, time - current.startedAt)
    const t = current.duration > 0 ? current.elapsed / current.duration : 1
    const progress = smoothstep(t)
    const zoom = Math.max(0.1, Math.exp(
      Math.log(current.from.zoom)
      + (Math.log(current.to.zoom) - Math.log(current.from.zoom)) * progress
      - current.zoomDip * Math.sin(Math.PI * t) ** 2,
    ))
    const x = current.from.x + (current.to.x - current.from.x) * progress
    const y = current.from.y + (current.to.y - current.from.y) * progress
    const state = api.getAppState()
    api.updateScene({
      appState: {
        zoom: { value: zoom as typeof state.zoom.value },
        shouldCacheIgnoreZoom: t < 1,
        scrollX: state.width / (2 * zoom) - x,
        scrollY: state.height / (2 * zoom) - y,
      },
    })

    if (t < 1) frame = requestAnimationFrame(animate)
    else motion = undefined
  }

  const begin = (to: Viewport, duration: number) => {
    const from = actualViewport(api)
    const flyOver = request.fromSlideId !== undefined
      && request.fromSlideId !== request.slideId
    const overview = Math.max(0.1, Math.min(
      from.zoom,
      to.zoom,
      to.zoom * CAMERA_ZOOM_OUT_FACTOR / CAMERA_TARGET_ZOOM_FACTOR,
    ))
    motion = {
      from,
      to,
      duration,
      elapsed: 0,
      // One smooth zoom-out/travel/zoom-in curve, not three restarted RAFs.
      zoomDip: flyOver
        ? Math.max(0, Math.log(Math.sqrt(from.zoom * to.zoom) / overview))
        : 0,
    }
    frame = requestAnimationFrame(animate)
  }

  const reconcileScene = () => {
    if (!motion) return
    const next = targetViewport(api, request.slideId)
    if (!next) return cancel()
    if (next.x === motion.to.x && next.y === motion.to.y
      && next.zoom === motion.to.zoom) return

    const remaining = Math.max(1, motion.duration - motion.elapsed)
    if (frame !== undefined) cancelAnimationFrame(frame)
    begin(next, remaining)
  }

  const target = targetViewport(api, request.slideId)
  if (target) {
    const duration = request.fromSlideId === request.slideId
      ? CAMERA_ZOOM_IN_DURATION
      : request.fromSlideId === undefined
        ? CAMERA_TRAVEL_DURATION + CAMERA_ZOOM_IN_DURATION
        : CAMERA_ZOOM_OUT_DURATION + CAMERA_TRAVEL_DURATION + CAMERA_ZOOM_IN_DURATION
    begin(target, duration)
  }
  return { cancel, reconcileScene }
}
