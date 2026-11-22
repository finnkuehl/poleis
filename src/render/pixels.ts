// Pixel painting for the terrain textures (no PixiJS, easy to test): a small canvas of
// premultiplied float RGBA with anti-aliased ellipses and tapered strokes, wrapping (for seamless
// textures) or clipped (for atlas cells). Used by meadow.ts and sea.ts.

/**
 * A small RGBA canvas of premultiplied floats (0..1). `wrap`: drawing wraps around the edges,
 * so the result tiles seamlessly; else drawing is clipped to `clip` (x0, y0, x1, y1).
 */
export class Canvas {
  readonly data: Float32Array;
  clip: [number, number, number, number];
  constructor(
    readonly w: number,
    readonly h: number,
    readonly wrap: boolean,
  ) {
    this.data = new Float32Array(w * h * 4);
    this.clip = [0, 0, w, h];
  }

  /** Paints `color` with `alpha` (0..1) over pixel (x, y) (source over). */
  blend(x: number, y: number, color: number, alpha: number): void {
    if (alpha <= 0) return;
    let px = x;
    let py = y;
    if (this.wrap) {
      px = ((px % this.w) + this.w) % this.w;
      py = ((py % this.h) + this.h) % this.h;
    } else {
      const [x0, y0, x1, y1] = this.clip;
      if (px < x0 || py < y0 || px >= x1 || py >= y1) return;
    }
    const i = (py * this.w + px) * 4;
    const a = Math.min(1, alpha);
    const k = 1 - a;
    const d = this.data;
    d[i] = (((color >> 16) & 255) / 255) * a + d[i] * k;
    d[i + 1] = (((color >> 8) & 255) / 255) * a + d[i + 1] * k;
    d[i + 2] = ((color & 255) / 255) * a + d[i + 2] * k;
    d[i + 3] = a + d[i + 3] * k;
  }

  /** Fills the whole canvas with one opaque color. */
  fill(color: number): void {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.blend(x, y, color, 1);
  }

  /** Anti-aliased ellipse; `soft`: its alpha falls off smoothly from the middle to the rim. */
  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: number,
    alpha: number,
    soft = false,
  ): void {
    const x0 = Math.floor(cx - rx - 1);
    const x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1);
    const y1 = Math.ceil(cy + ry + 1);
    const r = Math.min(rx, ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const u = (x + 0.5 - cx) / rx;
        const v = (y + 0.5 - cy) / ry;
        const d = Math.sqrt(u * u + v * v);
        let a: number;
        if (soft) a = d >= 1 ? 0 : (1 - d * d) ** 2;
        else a = Math.max(0, Math.min(1, (1 - d) * r + 0.5));
        this.blend(x, y, color, alpha * a);
      }
    }
  }

  /** Anti-aliased tapered stroke from (x0, y0) (width w0) to (x1, y1) (width w1). */
  stroke(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    w0: number,
    w1: number,
    color: number,
    alpha: number,
  ): void {
    const pad = Math.max(w0, w1) / 2 + 1;
    const bx0 = Math.floor(Math.min(x0, x1) - pad);
    const bx1 = Math.ceil(Math.max(x0, x1) + pad);
    const by0 = Math.floor(Math.min(y0, y1) - pad);
    const by1 = Math.ceil(Math.max(y0, y1) + pad);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1;
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        const px = x + 0.5 - x0;
        const py = y + 0.5 - y0;
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
        const dist = Math.hypot(px - t * dx, py - t * dy);
        const half = (w0 + (w1 - w0) * t) / 2;
        const a = Math.max(0, Math.min(1, half - dist + 0.5));
        this.blend(x, y, color, alpha * a);
      }
    }
  }

  /** The pixels as premultiplied RGBA bytes. */
  bytes(): Uint8Array {
    const out = new Uint8Array(this.data.length);
    for (let i = 0; i < this.data.length; i++) {
      out[i] = Math.round(Math.max(0, Math.min(1, this.data[i])) * 255);
    }
    return out;
  }
}

/** Mixes two 0xRRGGBB colors. */
export function mix(a: number, b: number, t: number): number {
  const ch = (s: number): number => {
    const ca = (a >> s) & 255;
    return Math.round(ca + (((b >> s) & 255) - ca) * t);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
