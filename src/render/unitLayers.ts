// Unit tokens, fog of war and attack-target outlines.
import { Container, Graphics, Text } from 'pixi.js';
import { hexCorners, hexToPixel, type Hex } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import { visibleTiles } from '../core/rules/vision';
import type { GameState, PlayerId } from '../core/state';
import { UNITS } from '../data';
import { hexSize } from './config';
import {
  fogEdgeMask,
  fogShade,
  fogSignature,
  fogState,
  hpBarColor,
  unitTokenOffset,
  type FogState,
} from './fog';
import { insetBands } from './geometry';
import { playerColorOf } from './playerColor';
import { scaleColor, taperedStroke, tileRng } from './terrain';
import { theme } from './theme';

export interface UnitLayers {
  /** Layers in drawing order: units, fog, attack targets. */
  units: Container;
  fog: Graphics;
  attack: Graphics;
  /** Drag ghost, to be added on top of everything. */
  ghost: Container;
  update(state: GameState, viewer: PlayerId): void;
  /** Test option: no fog, enemy units drawn everywhere. Takes effect on the next update. */
  setRevealAll(value: boolean): void;
  setAttackTargets(hexes: readonly Hex[]): void;
  /** Semi-transparent ghost token at world position (x, y); null hides it. */
  setGhost(unit: { type: string; owner: number } | null, x?: number, y?: number): void;
}

function flatCorners(h: Hex, size = hexSize): number[] {
  return hexCorners(hexToPixel(h, hexSize), size).flatMap((p) => [p.x, p.y]);
}

/** Unexplored tiles use this many slightly different shades of the fog color (soft patches). */
const FOG_SHADES = 5;

/** Fills all polygons at once (one draw instruction). */
function fillAll(g: Graphics, polys: readonly number[][], color: number, alpha: number): void {
  if (polys.length === 0) return;
  for (const p of polys) g.poly(p);
  g.fill({ color, alpha });
}

export function createUnitLayers(): UnitLayers {
  const units = new Container();
  const tokens = new Graphics();
  const icons = new Container();
  units.addChild(tokens, icons);
  const fog = new Graphics();
  const attack = new Graphics();
  /** One Text per unit id, created/destroyed only when units appear/disappear. */
  const iconTexts = new Map<number, { text: Text; type: string }>();
  let fogSig = '';
  /** Test option: show the whole map (no fog, enemy units everywhere). */
  let revealAll = false;
  /** Latest state, for the colors of the drag ghost. */
  let lastState: GameState | null = null;

  function drawUnits(state: GameState, viewer: PlayerId, visible: readonly boolean[]): void {
    tokens.clear();
    const seen = new Set<number>();
    const buildingTiles = new Set<number>();
    for (const b of state.buildings) buildingTiles.add(tileIndex(state.map, b.hex));
    const radius = hexSize * theme.unitRadiusFactor;
    const barW = hexSize * theme.hpBarWidthFactor;
    const barH = hexSize * theme.hpBarHeightFactor;
    for (const u of state.units) {
      const idx = tileIndex(state.map, u.hex);
      // Enemy units only where the viewer currently sees
      if (u.owner !== viewer && !visible[idx]) continue;
      seen.add(u.id);
      const def = UNITS[u.type];
      const base = hexToPixel(u.hex, hexSize);
      const cx = base.x;
      const cy = base.y + unitTokenOffset(buildingTiles.has(idx), hexSize);
      const done = u.owner === viewer && u.movesLeft === 0 && (u.attacked || u.hasMoved);
      const alpha = done ? theme.unitDoneAlpha : 1;

      tokens
        .circle(cx, cy, radius)
        .fill({ color: playerColorOf(state, u.owner), alpha })
        .stroke({ color: theme.unitRimColor, width: theme.unitRimWidth, alpha });
      // HP bar under the token
      const share = Math.max(0, Math.min(1, u.hp / def.hp));
      const bx = cx - barW / 2;
      const by = cy + radius + 2;
      tokens.rect(bx, by, barW, barH).fill({ color: theme.hpBarBackColor, alpha });
      tokens.rect(bx, by, barW * share, barH).fill({ color: hpBarColor(share), alpha });

      let entry = iconTexts.get(u.id);
      if (!entry || entry.type !== u.type) {
        entry?.text.destroy();
        const text = new Text({
          text: def.icon,
          style: { fontSize: hexSize * theme.unitIconSizeFactor, fontFamily: theme.fontFamily },
          resolution: 2,
        });
        text.anchor.set(0.5);
        icons.addChild(text);
        entry = { text, type: u.type };
        iconTexts.set(u.id, entry);
      }
      entry.text.position.set(cx, cy);
      entry.text.alpha = alpha;
      entry.text.visible = true;
    }
    for (const [id, entry] of iconTexts) {
      if (seen.has(id)) continue;
      entry.text.destroy();
      iconTexts.delete(id);
    }
  }

  function drawFog(state: GameState, viewer: PlayerId, visible: readonly boolean[]): void {
    const explored = state.players.find((p) => p.id === viewer)?.explored ?? [];
    const sig = fogSignature(explored, visible);
    if (sig === fogSig) return;
    fogSig = sig;
    fog.clear();
    const map = state.map;
    const states: FogState[] = [];
    for (let i = 0; i < visible.length; i++) states.push(fogState(explored, visible, i));

    // Unexplored: opaque dark sea-blue in a few soft, cloud-like shades plus faint wave strokes.
    // Drawn a little larger than the tile so no seams show between neighbors.
    const shades: number[][][] = Array.from({ length: FOG_SHADES }, () => []);
    const waves: number[][] = [];
    const dim: number[][] = [];
    const feather: number[][] = [];
    const dimFeather: number[][] = [];
    for (let i = 0; i < states.length; i++) {
      const h = hexAtIndex(map, i);
      const c = hexToPixel(h, hexSize);
      const f = states[i];
      if (f === 'hidden') {
        const shade = Math.min(FOG_SHADES - 1, Math.floor(fogShade(c.x, c.y) * FOG_SHADES));
        shades[shade].push(flatCorners(h, hexSize + 0.5));
        const rng = tileRng(h.q, h.r, 91);
        if (rng() < theme.fogTextureChance) {
          const x0 = c.x + (rng() - 0.5) * 0.6 * hexSize;
          const y0 = c.y + (rng() - 0.5) * 0.6 * hexSize;
          const w = (0.14 + rng() * 0.06) * hexSize;
          const line = [];
          for (let s = 0; s <= 8; s++) {
            const u = s / 8;
            line.push({
              x: x0 - w + 2 * w * u,
              y: y0 - 0.06 * hexSize * Math.sin(Math.PI * 2 * u),
            });
          }
          waves.push(taperedStroke(line, 1.4));
        }
        continue;
      }
      if (f === 'dim') dim.push(flatCorners(h, hexSize));
      // Feathered edge on explored tiles next to unexplored ones: stacked translucent bands
      const corners = hexCorners(c, hexSize);
      const toHidden = fogEdgeMask(map, h, states, 'hidden');
      if (toHidden.some(Boolean)) {
        for (const d of theme.fogFeatherDepths) {
          for (const b of insetBands(c, corners, toHidden, d * hexSize)) {
            feather.push(b.flatMap((p) => [p.x, p.y]));
          }
        }
      }
      // Softer edge where visible tiles meet dimmed ones
      if (f === 'clear') {
        const toDim = fogEdgeMask(map, h, states, 'dim');
        if (toDim.some(Boolean)) {
          for (const d of theme.fogDimFeatherDepths) {
            for (const b of insetBands(c, corners, toDim, d * hexSize)) {
              dimFeather.push(b.flatMap((p) => [p.x, p.y]));
            }
          }
        }
      }
    }
    shades.forEach((polys, k) => {
      if (polys.length === 0) return;
      for (const p of polys) fog.poly(p);
      const f = 1 + (k / (FOG_SHADES - 1) - 0.5) * 2 * theme.fogVariation;
      fog.fill(scaleColor(theme.fogHiddenColor, f));
    });
    fillAll(fog, waves, theme.fogTextureColor, theme.fogTextureAlpha);
    fillAll(fog, dim, theme.fogDimColor, theme.fogDimAlpha);
    fillAll(fog, dimFeather, theme.fogDimColor, theme.fogDimFeatherAlpha);
    fillAll(fog, feather, theme.fogHiddenColor, theme.fogFeatherAlpha);
  }

  // Drag ghost: same look as a unit token, larger and see-through; drawn above everything.
  const ghost = new Container();
  const ghostBody = new Graphics();
  let ghostText: Text | null = null;
  let ghostKey = '';
  ghost.addChild(ghostBody);
  ghost.visible = false;
  ghost.alpha = theme.dragGhostAlpha;
  ghost.scale.set(theme.dragGhostScale);

  return {
    units,
    fog,
    attack,
    ghost,
    setGhost(unit, x = 0, y = 0) {
      if (!unit) {
        ghost.visible = false;
        return;
      }
      const color = lastState ? playerColorOf(lastState, unit.owner) : theme.playerColors[0];
      const key = `${unit.type}:${unit.owner}:${color}`;
      if (key !== ghostKey) {
        ghostKey = key;
        const radius = hexSize * theme.unitRadiusFactor;
        ghostBody.clear();
        ghostBody
          .circle(0, 0, radius)
          .fill({ color })
          .stroke({ color: theme.unitRimColor, width: theme.unitRimWidth });
        ghostText?.destroy();
        ghostText = new Text({
          text: UNITS[unit.type as keyof typeof UNITS].icon,
          style: { fontSize: hexSize * theme.unitIconSizeFactor, fontFamily: theme.fontFamily },
          resolution: 2,
        });
        ghostText.anchor.set(0.5);
        ghost.addChild(ghostText);
      }
      ghost.position.set(x, y);
      ghost.visible = true;
    },
    setRevealAll(value) {
      revealAll = value;
      fogSig = '';
    },
    update(state, viewer) {
      lastState = state;
      if (revealAll) {
        drawUnits(
          state,
          viewer,
          state.map.tiles.map(() => true),
        );
        fog.clear();
        fogSig = '';
        return;
      }
      const visible = visibleTiles(state, viewer);
      drawUnits(state, viewer, visible);
      drawFog(state, viewer, visible);
    },
    setAttackTargets(hexes) {
      attack.clear();
      for (const h of hexes) {
        attack
          .poly(flatCorners(h))
          .fill({ color: theme.attackColor, alpha: theme.attackFillAlpha })
          .stroke({ color: theme.attackColor, width: theme.attackWidth, join: 'round' });
      }
    },
  };
}
