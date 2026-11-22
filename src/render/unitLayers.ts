// Unit figures/tokens, fog of war and attack-target outlines.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { hexCorners, hexToPixel, type Hex } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import { visibleTiles } from '../core/rules/vision';
import type { GameState, PlayerId } from '../core/state';
import { UNITS, type UnitId } from '../data';
import { createArtObject, NO_ART, setArtLayer, type ArtSet } from './art';
import { ART_CANVAS, artModeOf, depthKey, drawsOwnerDisc, type ArtMode } from './artLayout';
import { hexSize } from './config';
import {
  buildingsShownTo,
  fogEdgeMask,
  fogShade,
  fogSignature,
  fogState,
  hpBarColor,
  type FogState,
} from './fog';
import { unitsShownTo } from './groundworks';
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

/**
 * Lowest top edge of an HP bar (below the tile center, world px) that keeps the whole bar inside
 * the tile: its lower corners must stay clear of the two lower hex edges.
 */
export function hpBarLowest(barW: number, barH: number, size = hexSize): number {
  // Below y = size / 2 the hex narrows: half width = (size - y) * sqrt(3)
  return size - (barW / 2 + 2) / Math.sqrt(3) - barH;
}

/** Fills all polygons at once (one draw instruction). */
function fillAll(g: Graphics, polys: readonly number[][], color: number, alpha: number): void {
  if (polys.length === 0) return;
  for (const p of polys) g.poly(p);
  g.fill({ color, alpha });
}

/** `art`: the loaded unit art (missing entries fall back to token + emoji). */
export function createUnitLayers(art: ArtSet = NO_ART): UnitLayers {
  const units = new Container();
  /** Colored tokens under emoji and old flat art. */
  const tokens = new Graphics();
  /** Unit art and emoji, sorted by row (a lower figure overlaps the one above). */
  const figures = new Container();
  figures.sortableChildren = true;
  /** HP bars, above all figures so they stay readable. */
  const bars = new Graphics();
  units.addChild(tokens, figures, bars);
  const fog = new Graphics();
  const attack = new Graphics();

  /** Visuals of one unit, created/destroyed only when units appear/disappear. */
  interface UnitVisual {
    type: string;
    mode: ArtMode;
    /** Art container [owner layer, art] or the fallback emoji; moved, sorted and faded as one piece. */
    root: Container;
    accent: Sprite | null;
  }
  const visuals = new Map<number, UnitVisual>();

  function createVisual(type: UnitId): UnitVisual {
    const asset = art.units[type];
    const mode = artModeOf(asset);
    let visual: UnitVisual;
    if (asset) {
      const { root, accent } = createArtObject(asset);
      visual = { type, mode, root, accent };
    } else {
      const icon = new Text({
        text: UNITS[type].icon,
        style: { fontSize: hexSize * theme.unitIconSizeFactor, fontFamily: theme.fontFamily },
        resolution: 2,
      });
      icon.anchor.set(0.5);
      visual = { type, mode, root: icon, accent: null };
    }
    figures.addChild(visual.root);
    return visual;
  }
  let fogSig = '';
  /** Test option: show the whole map (no fog, enemy units everywhere). */
  let revealAll = false;
  /** Latest state, for the colors of the drag ghost. */
  let lastState: GameState | null = null;

  function drawUnits(state: GameState, viewer: PlayerId, visible: readonly boolean[] | null): void {
    tokens.clear();
    bars.clear();
    const seen = new Set<number>();
    // On a tile with a building the viewer sees, the unit steps aside to the front of the tile
    const buildingTiles = new Set<number>();
    for (const b of buildingsShownTo(state, viewer, revealAll)) {
      buildingTiles.add(tileIndex(state.map, b.hex));
    }
    const radius = hexSize * theme.unitRadiusFactor;
    const barW = hexSize * theme.hpBarWidthFactor;
    const barH = hexSize * theme.hpBarHeightFactor;
    // Enemy units only where the viewer currently sees (the same filter as the unit footprints)
    for (const u of unitsShownTo(state, viewer, revealAll, visible)) {
      const idx = tileIndex(state.map, u.hex);
      seen.add(u.id);
      const def = UNITS[u.type];
      const base = hexToPixel(u.hex, hexSize);
      const cx = base.x;
      const front = buildingTiles.has(idx);
      const cy = base.y + (front ? theme.ground.unitFrontOffset * hexSize : 0);
      const done = u.owner === viewer && u.movesLeft === 0 && (u.attacked || u.hasMoved);
      const alpha = done ? theme.unitDoneAlpha : 1;
      const color = playerColorOf(state, u.owner);

      let v = visuals.get(u.id);
      if (!v || v.type !== u.type) {
        // destroy() keeps the shared textures (only Text frees its own)
        v?.root.destroy({ children: true });
        v = createVisual(u.type);
        visuals.set(u.id, v);
      }
      // Units move: position and draw order are updated every time. The layers do not overlap,
      // so fading the whole container looks right.
      v.root.position.set(cx, cy);
      v.root.zIndex = depthKey(u.hex);
      v.root.alpha = alpha;
      if (v.accent) v.accent.tint = color;

      const disc = drawsOwnerDisc(v.mode);
      if (disc) {
        // A drawn token gets a soft ground shadow to the lower right (the art has its own)
        tokens.ellipse(cx + radius * 0.12, cy + radius * 0.35, radius * 1.05, radius * 0.5).fill({
          color: theme.terrainPaint.shadowColor,
          alpha: theme.ground.unitShadowAlpha * alpha,
        });
        tokens
          .circle(cx, cy, radius)
          .fill({ color, alpha })
          .stroke({ color: theme.unitRimColor, width: theme.unitRimWidth, alpha });
      }
      // HP bar under the token (the art's token is a flat 2:1 ellipse); at the front of a tile it
      // moves up onto the token's front rim, so it stays inside the tile
      const asset = art.units[u.type];
      const tokenBottom =
        disc || !asset ? radius : (ART_CANVAS.unit.baseWidth / 4) * asset.placement.scale;
      const share = Math.max(0, Math.min(1, u.hp / def.hp));
      const bx = cx - barW / 2;
      const by = Math.min(cy + tokenBottom + 2, base.y + hpBarLowest(barW, barH));
      bars.rect(bx, by, barW, barH).fill({ color: theme.hpBarBackColor, alpha });
      bars.rect(bx, by, barW * share, barH).fill({ color: hpBarColor(share), alpha });
    }
    for (const [id, v] of visuals) {
      if (seen.has(id)) continue;
      v.root.destroy({ children: true });
      visuals.delete(id);
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

  // Drag ghost: same look as a unit, larger and see-through; drawn above everything.
  const ghost = new Container();
  const ghostBody = new Graphics();
  // Owner layer first, art on top (see createArtObject)
  const ghostAccent = new Sprite();
  const ghostArt = new Sprite();
  let ghostText: Text | null = null;
  let ghostKey = '';
  ghost.addChild(ghostBody, ghostAccent, ghostArt);
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
        const asset = art.units[unit.type];
        const radius = hexSize * theme.unitRadiusFactor;
        ghostBody.clear();
        if (drawsOwnerDisc(artModeOf(asset))) {
          ghostBody
            .circle(0, 0, radius)
            .fill({ color })
            .stroke({ color: theme.unitRimColor, width: theme.unitRimWidth });
        }
        ghostText?.destroy();
        ghostText = null;
        ghostArt.visible = false;
        ghostAccent.visible = false;
        if (asset) {
          // Same shared textures as the unit on the map
          setArtLayer(ghostArt, asset, asset.art).visible = true;
          if (asset.accent) {
            setArtLayer(ghostAccent, asset, asset.accent).visible = true;
            ghostAccent.tint = color;
          }
        } else {
          ghostText = new Text({
            text: UNITS[unit.type as UnitId].icon,
            style: { fontSize: hexSize * theme.unitIconSizeFactor, fontFamily: theme.fontFamily },
            resolution: 2,
          });
          ghostText.anchor.set(0.5);
          ghost.addChild(ghostText);
        }
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
        drawUnits(state, viewer, null);
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
