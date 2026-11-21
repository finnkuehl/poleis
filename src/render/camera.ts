import type { Container } from 'pixi.js';
import { cameraConfig } from './config';

/** world.position = (x, y), world.scale = zoom; screen = world * zoom + (x, y) */
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}
/** Rectangle in world coordinates (pixels at zoom 1) */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** Viewport in CSS pixels */
export interface Size {
  width: number;
  height: number;
}
export interface ZoomLimits {
  min: number;
  max: number;
}

export function screenToWorld(cam: CameraState, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - cam.x) / cam.zoom, y: (sy - cam.y) / cam.zoom };
}

export function worldToScreen(cam: CameraState, wx: number, wy: number): { x: number; y: number } {
  return { x: wx * cam.zoom + cam.x, y: wy * cam.zoom + cam.y };
}

export function zoomLimits(world: Rect, viewport: Size, hexSize: number): ZoomLimits {
  const fit = Math.min(viewport.width / world.width, viewport.height / world.height);
  const min = cameraConfig.minZoomFitFactor * fit;
  const max = Math.max(cameraConfig.maxHexScreenRadiusPx / hexSize, min);
  return { min, max };
}

/** Zooms so that the world point under (sx, sy) stays at the same screen position. */
export function zoomAt(cam: CameraState, sx: number, sy: number, newZoom: number): CameraState {
  const w = screenToWorld(cam, sx, sy);
  return { x: sx - w.x * newZoom, y: sy - w.y * newZoom, zoom: newZoom };
}

/** Clamps one axis: center a small map, let a large one go at most panMarginPx past the edge. */
function clampAxis(
  pos: number,
  worldStart: number,
  worldLen: number,
  zoom: number,
  view: number,
): number {
  const mapLen = worldLen * zoom;
  const offset = worldStart * zoom;
  if (mapLen <= view) return (view - mapLen) / 2 - offset;
  const margin = cameraConfig.panMarginPx;
  const lo = view - margin - mapLen - offset;
  const hi = margin - offset;
  return Math.min(hi, Math.max(lo, pos));
}

export function clampCamera(
  cam: CameraState,
  world: Rect,
  viewport: Size,
  limits: ZoomLimits,
): CameraState {
  const zoom = Math.min(limits.max, Math.max(limits.min, cam.zoom));
  let c = cam;
  if (zoom !== cam.zoom) c = zoomAt(cam, viewport.width / 2, viewport.height / 2, zoom);
  return {
    zoom,
    x: clampAxis(c.x, world.x, world.width, zoom, viewport.width),
    y: clampAxis(c.y, world.y, world.height, zoom, viewport.height),
  };
}

/** Start view: minimum zoom, map centered. */
export function fitCamera(world: Rect, viewport: Size, limits: ZoomLimits): CameraState {
  return clampCamera({ x: 0, y: 0, zoom: limits.min }, world, viewport, limits);
}

/** Camera that shows world point (wx, wy) in the viewport center; the zoom is clamped first. */
export function centeredCamera(
  wx: number,
  wy: number,
  zoom: number,
  viewport: Size,
  limits: ZoomLimits,
): CameraState {
  const z = Math.min(limits.max, Math.max(limits.min, zoom));
  return { zoom: z, x: viewport.width / 2 - wx * z, y: viewport.height / 2 - wy * z };
}

export interface CameraOptions {
  /** World bounds of the map */
  world: Rect;
  /** Hex radius in world pixels (for the zoom limit) */
  hexSize: number;
  /** Tap/click at a screen position (relative to the canvas corner) */
  onTap: (sx: number, sy: number) => void;
}

interface PointerInfo {
  x: number;
  y: number;
}

/** Controls the camera via pointer events (mouse, touch, pen) and mouse wheel. */
export class CameraController {
  private readonly canvas: HTMLCanvasElement;
  private readonly target: Container;
  private readonly options: CameraOptions;
  private viewport: Size;
  private limits: ZoomLimits;
  private cam: CameraState;

  private readonly pointers = new Map<number, PointerInfo>();
  /** Start position of the single finger (for the tap threshold) */
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private lastY = 0;
  private dragging = false;
  /** Two fingers were involved in this gesture: no longer a tap */
  private multiTouch = false;
  private pinchDist = 0;
  private pinchMidX = 0;
  private pinchMidY = 0;

  constructor(canvas: HTMLCanvasElement, target: Container, options: CameraOptions) {
    this.canvas = canvas;
    this.target = target;
    this.options = options;
    const rect = canvas.getBoundingClientRect();
    this.viewport = { width: rect.width, height: rect.height };
    this.limits = zoomLimits(options.world, this.viewport, options.hexSize);
    this.cam = fitCamera(options.world, this.viewport, this.limits);
    this.apply();

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  get state(): CameraState {
    return { ...this.cam };
  }

  setViewport(size: Size): void {
    this.viewport = { ...size };
    this.limits = zoomLimits(this.options.world, this.viewport, this.options.hexSize);
    this.set(this.cam);
  }

  fit(): void {
    this.cam = fitCamera(this.options.world, this.viewport, this.limits);
    this.apply();
  }

  /** Centers the view on a world point at the given zoom (clamped like everything else). */
  centerOn(worldX: number, worldY: number, zoom: number): void {
    this.set(centeredCamera(worldX, worldY, zoom, this.viewport, this.limits));
  }

  destroy(): void {
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.onPointerDown);
    c.removeEventListener('pointermove', this.onPointerMove);
    c.removeEventListener('pointerup', this.onPointerUp);
    c.removeEventListener('pointercancel', this.onPointerCancel);
    c.removeEventListener('wheel', this.onWheel);
    c.removeEventListener('contextmenu', this.onContextMenu);
    this.pointers.clear();
  }

  /** Clamps the target zoom so that zoomAt does not shift the view at the limit. */
  private clampZoom(zoom: number): number {
    return Math.min(this.limits.max, Math.max(this.limits.min, zoom));
  }

  private set(cam: CameraState): void {
    this.cam = clampCamera(cam, this.options.world, this.viewport, this.limits);
    this.apply();
  }

  private apply(): void {
    this.target.position.set(this.cam.x, this.cam.y);
    this.target.scale.set(this.cam.zoom);
  }

  /** Pointer position in canvas coordinates (CSS pixels) */
  private local(e: PointerEvent | WheelEvent): PointerInfo {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private readPinch(): { dist: number; midX: number; midY: number } {
    const [a, b] = [...this.pointers.values()];
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
    };
  }

  /** Resets the start point of the (only) remaining finger so nothing jumps. */
  private resetSingle(): void {
    const p = [...this.pointers.values()][0];
    this.startX = this.lastX = p.x;
    this.startY = this.lastY = p.y;
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Pointer may already be gone - not critical
    }
    if (this.pointers.size === 1) {
      this.multiTouch = false;
      this.dragging = false;
      this.resetSingle();
    } else if (this.pointers.size === 2) {
      this.multiTouch = true;
      const pinch = this.readPinch();
      this.pinchDist = pinch.dist;
      this.pinchMidX = pinch.midX;
      this.pinchMidY = pinch.midY;
    }
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);

    if (this.pointers.size === 1) {
      if (!this.dragging) {
        const moved = Math.hypot(p.x - this.startX, p.y - this.startY);
        if (moved <= cameraConfig.tapThresholdPx) return;
        this.dragging = true;
      }
      this.set({
        ...this.cam,
        x: this.cam.x + (p.x - this.lastX),
        y: this.cam.y + (p.y - this.lastY),
      });
      this.lastX = p.x;
      this.lastY = p.y;
    } else if (this.pointers.size === 2) {
      const pinch = this.readPinch();
      let cam = this.cam;
      if (this.pinchDist > 0 && pinch.dist > 0) {
        const zoom = this.clampZoom(cam.zoom * (pinch.dist / this.pinchDist));
        cam = zoomAt(cam, this.pinchMidX, this.pinchMidY, zoom);
      }
      cam = {
        ...cam,
        x: cam.x + (pinch.midX - this.pinchMidX),
        y: cam.y + (pinch.midY - this.pinchMidY),
      };
      this.pinchDist = pinch.dist;
      this.pinchMidX = pinch.midX;
      this.pinchMidY = pinch.midY;
      this.set(cam);
    }
  };

  private release(e: PointerEvent): boolean {
    if (!this.pointers.has(e.pointerId)) return false;
    this.pointers.delete(e.pointerId);
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      // already released - not critical
    }
    if (this.pointers.size === 2) {
      // 3 -> 2 fingers: reset the pinch starting values so nothing jumps
      const pinch = this.readPinch();
      this.pinchDist = pinch.dist;
      this.pinchMidX = pinch.midX;
      this.pinchMidY = pinch.midY;
    } else if (this.pointers.size === 1) {
      // 2 -> 1 finger: the remaining one keeps dragging, without a jump
      this.dragging = true;
      this.resetSingle();
    }
    return true;
  }

  private readonly onPointerUp = (e: PointerEvent): void => {
    const p = this.local(e);
    const wasSingle = this.pointers.size === 1;
    if (!this.release(e)) return;
    if (wasSingle && !this.multiTouch && !this.dragging) {
      this.options.onTap(p.x, p.y);
    }
    if (this.pointers.size === 0) {
      this.dragging = false;
      this.multiTouch = false;
    }
  };

  private readonly onPointerCancel = (e: PointerEvent): void => {
    this.release(e);
    if (this.pointers.size === 0) {
      this.dragging = false;
      this.multiTouch = false;
    }
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const p = this.local(e);
    const zoom = this.cam.zoom * Math.exp(-delta * cameraConfig.wheelZoomSpeed);
    this.set(zoomAt(this.cam, p.x, p.y, this.clampZoom(zoom)));
  };

  private readonly onContextMenu = (e: Event): void => {
    e.preventDefault();
  };
}
