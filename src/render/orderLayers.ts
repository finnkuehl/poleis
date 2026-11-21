// Move-order paths: faint lines for units on their way, emphasized path with turn numbers.
import { Container, Graphics, Text } from 'pixi.js';
import { hexToPixel, type Hex } from '../core/hex';
import type { OrderStop } from '../core/rules/orders';
import { hexSize } from './config';
import { sharedEdgeMidpoint } from './geometry';
import { theme } from './theme';

export interface OrderPath {
  /** Tiles from the unit's tile to the destination, both included. */
  path: readonly Hex[];
  /** Turn stops from planMoveOrder (core/rules/orders.ts). */
  stops: readonly OrderStop[];
  /** 'faint' = a unit on its way that is not selected; 'active' = the selected unit's order or the destination preview. */
  style: 'faint' | 'active';
}

export interface OrderLayers {
  /** Lines, flags, dots and badges; add the container (it holds the numbers too). */
  layer: Container;
  setOrderPaths(paths: readonly OrderPath[]): void;
}

function sameHex(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

export function createOrderLayers(): OrderLayers {
  const layer = new Container();
  const g = new Graphics();
  const numbers = new Container();
  layer.addChild(g, numbers);
  /** Pool of number labels; grows/shrinks only when the count changes. */
  const pool: Text[] = [];
  let used = 0;

  function label(value: number, x: number, y: number): void {
    let t = pool[used];
    if (!t) {
      t = new Text({
        text: '',
        style: {
          fontSize: hexSize * theme.orderBadgeRadiusFactor * 1.4,
          fontFamily: theme.fontFamily,
          fontWeight: 'bold',
          fill: theme.orderBadgeTextColor,
        },
        resolution: 2,
      });
      t.anchor.set(0.5);
      numbers.addChild(t);
      pool.push(t);
    }
    const s = String(value);
    if (t.text !== s) t.text = s;
    t.position.set(x, y);
    t.visible = true;
    used++;
  }

  function flag(x: number, y: number, alpha: number): void {
    // Pole stands on (x, y), pennant points right from the top of the pole
    const h = hexSize * theme.orderFlagHeightFactor;
    const w = hexSize * theme.orderFlagPennantWidthFactor;
    const ph = hexSize * theme.orderFlagPennantHeightFactor;
    g.moveTo(x, y)
      .lineTo(x, y - h)
      .stroke({ color: theme.orderMarbleColor, width: 2, alpha });
    g.poly([x, y - h, x + w, y - h + ph / 2, x, y - h + ph])
      .fill({ color: theme.playerColors[0], alpha })
      .stroke({ color: theme.orderMarbleColor, width: 1, alpha });
  }

  function drawPath(p: OrderPath): void {
    if (p.path.length < 2) return;
    const active = p.style === 'active';
    const pts = p.path.map((h) => hexToPixel(h, hexSize));
    const start = sharedEdgeMidpoint(p.path[0], p.path[1], hexSize);
    const line = [start, ...pts.slice(1)];
    const width = hexSize * (active ? theme.orderActiveWidthFactor : theme.orderFaintWidthFactor);
    const trace = (): void => {
      g.moveTo(line[0].x, line[0].y);
      for (let i = 1; i < line.length; i++) g.lineTo(line[i].x, line[i].y);
    };
    if (active) {
      trace();
      g.stroke({
        color: theme.orderDarkColor,
        width: width + hexSize * theme.orderUnderStrokeExtraFactor,
        alpha: theme.orderUnderStrokeAlpha,
        cap: 'round',
        join: 'round',
      });
    }
    trace();
    g.stroke({
      color: theme.orderMarbleColor,
      width,
      alpha: active ? theme.orderActiveAlpha : theme.orderFaintAlpha,
      cap: 'round',
      join: 'round',
    });

    const dest = p.path[p.path.length - 1];
    const dp = pts[pts.length - 1];
    const shift = hexSize * theme.orderDestOffsetFactor;
    if (!active) {
      flag(dp.x, dp.y, theme.orderFaintFlagAlpha);
      return;
    }
    const r = hexSize * theme.orderBadgeRadiusFactor;
    let flagDrawn = false;
    for (const stop of p.stops) {
      const sp = hexToPixel(stop.hex, hexSize);
      const isDest = sameHex(stop.hex, dest);
      if (stop.turn < 1) {
        if (isDest) {
          flag(dp.x, dp.y, 1);
          flagDrawn = true;
        } else {
          g.circle(sp.x, sp.y, hexSize * theme.orderDotRadiusFactor).fill(theme.orderMarbleColor);
        }
        continue;
      }
      // On the destination, flag left and badge right of the center
      const bx = isDest ? sp.x + shift : sp.x;
      if (isDest) {
        flag(sp.x - shift, sp.y + r * 0.6, 1);
        flagDrawn = true;
      }
      g.circle(bx, sp.y, r)
        .fill(theme.orderDarkColor)
        .stroke({ color: theme.orderMarbleColor, width: theme.orderBadgeRimWidth });
      label(stop.turn, bx, sp.y);
    }
    if (!flagDrawn) flag(dp.x, dp.y, 1);
  }

  return {
    layer,
    setOrderPaths(paths) {
      g.clear();
      used = 0;
      for (const p of paths) drawPath(p);
      // Hide spare labels; drop them only when clearly more than needed
      for (let i = used; i < pool.length; i++) pool[i].visible = false;
      while (pool.length > used + 8) pool.pop()?.destroy();
    },
  };
}
