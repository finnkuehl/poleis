// Unit tokens, fog of war and attack-target outlines.
import { Container, Graphics, Text } from 'pixi.js';
import { hexCorners, hexToPixel, type Hex } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import { visibleTiles } from '../core/rules/vision';
import type { GameState, PlayerId } from '../core/state';
import { UNITS } from '../data';
import { hexSize } from './config';
import { fogSignature, fogState, hpBarColor, unitTokenOffset } from './fog';
import { theme } from './theme';

export interface UnitLayers {
  /** Layers in drawing order: units, fog, attack targets. */
  units: Container;
  fog: Graphics;
  attack: Graphics;
  /** Drag ghost, to be added on top of everything. */
  ghost: Container;
  update(state: GameState, viewer: PlayerId): void;
  setAttackTargets(hexes: readonly Hex[]): void;
  /** Semi-transparent ghost token at world position (x, y); null hides it. */
  setGhost(unit: { type: string; owner: number } | null, x?: number, y?: number): void;
}

function playerColor(player: number): number {
  const colors = theme.playerColors;
  return colors[((player % colors.length) + colors.length) % colors.length];
}

function flatCorners(h: Hex): number[] {
  return hexCorners(hexToPixel(h, hexSize), hexSize).flatMap((p) => [p.x, p.y]);
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
        .fill({ color: playerColor(u.owner), alpha })
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
    let hidden = false;
    let dim = false;
    for (let i = 0; i < visible.length; i++) {
      const f = fogState(explored, visible, i);
      if (f === 'hidden') {
        fog.poly(flatCorners(hexAtIndex(state.map, i)));
        hidden = true;
      }
    }
    // Same-colored thin stroke hides the seams between adjacent opaque tiles
    if (hidden) {
      fog.fill(theme.fogHiddenColor).stroke({ color: theme.fogHiddenColor, width: 1 });
    }
    for (let i = 0; i < visible.length; i++) {
      if (fogState(explored, visible, i) === 'dim') {
        fog.poly(flatCorners(hexAtIndex(state.map, i)));
        dim = true;
      }
    }
    if (dim) fog.fill({ color: theme.fogDimColor, alpha: theme.fogDimAlpha });
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
      const key = `${unit.type}:${unit.owner}`;
      if (key !== ghostKey) {
        ghostKey = key;
        const radius = hexSize * theme.unitRadiusFactor;
        ghostBody.clear();
        ghostBody
          .circle(0, 0, radius)
          .fill({ color: playerColor(unit.owner) })
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
    update(state, viewer) {
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
