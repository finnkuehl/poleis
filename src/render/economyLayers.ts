// Dynamic map layers: territory, roads, buildings, status badges, highlights, road preview.
import { Container, Graphics, Text } from 'pixi.js';
import { hexCorners, hexToPixel, type Hex, type Point } from '../core/hex';
import { hexAtIndex } from '../core/map';
import type { BuildingStatus } from '../core/rules/production';
import type { GameState } from '../core/state';
import { BUILDINGS } from '../data';
import { hexSize } from './config';
import { roadGeometry, territoryEdges } from './geometry';
import { badgeKind, cityRingStyle } from './style';
import { theme } from './theme';

export interface EconomyLayers {
  /** Layers in drawing order (add all to the map container in this order). */
  layers: Container[];
  update(state: GameState, statuses: Record<number, BuildingStatus>): void;
  setHighlights(hexes: readonly Hex[]): void;
  setPathPreview(path: readonly Hex[] | null, newTiles: readonly Hex[]): void;
}

function playerColor(player: number): number {
  const colors = theme.playerColors;
  return colors[((player % colors.length) + colors.length) % colors.length];
}

function flatCorners(c: Point): number[] {
  return hexCorners(c, hexSize).flatMap((p) => [p.x, p.y]);
}

export function createEconomyLayers(): EconomyLayers {
  const tint = new Graphics();
  const border = new Graphics();
  const roads = new Graphics();
  const plates = new Graphics();
  const icons = new Container();
  const badges = new Graphics();
  const highlights = new Graphics();
  const preview = new Graphics();

  /** One Text per building id; created/destroyed only when buildings appear/disappear. */
  const iconTexts = new Map<number, { text: Text; type: string }>();
  /** One resident-count Text per city id (same lifecycle as the icons). */
  const residentTexts = new Map<number, Text>();

  function drawTerritory(state: GameState): void {
    tint.clear();
    border.clear();
    const players = new Set<number>();
    for (const o of state.territory) if (o >= 0) players.add(o);
    for (const player of players) {
      const color = playerColor(player);
      for (let i = 0; i < state.territory.length; i++) {
        if (state.territory[i] !== player) continue;
        tint.poly(flatCorners(hexToPixel(hexAtIndex(state.map, i), hexSize)));
      }
      tint.fill({ color, alpha: theme.territoryTintAlpha });
      for (const { tile, edges } of territoryEdges(state, player)) {
        const corners = hexCorners(hexToPixel(hexAtIndex(state.map, tile), hexSize), hexSize);
        for (const e of edges) {
          const a = corners[e];
          const b = corners[(e + 1) % 6];
          border.moveTo(a.x, a.y).lineTo(b.x, b.y);
        }
      }
      border.stroke({
        color,
        width: theme.territoryBorderWidth,
        alpha: theme.territoryBorderAlpha,
        cap: 'round',
        join: 'round',
      });
    }
  }

  function drawRoads(state: GameState): void {
    roads.clear();
    const { segments, stubs } = roadGeometry(state);
    const width = hexSize * theme.roadWidthFactor;
    const center = (i: number): Point => hexToPixel(hexAtIndex(state.map, i), hexSize);
    for (const [a, b] of segments) {
      const pa = center(a);
      const pb = center(b);
      roads.moveTo(pa.x, pa.y).lineTo(pb.x, pb.y);
    }
    roads.stroke({ color: theme.roadColor, width, cap: 'round', join: 'round' });
    for (const i of stubs) {
      const p = center(i);
      roads.circle(p.x, p.y, width * 0.8);
    }
    roads.fill(theme.roadColor);
  }

  function drawBuildings(state: GameState, statuses: Record<number, BuildingStatus>): void {
    plates.clear();
    badges.clear();
    const seen = new Set<number>();
    const seenCities = new Set<number>();
    const cityById = new Map(state.cities.map((c) => [c.id, c]));
    const radius = hexSize * theme.plateRadiusFactor;
    const badgeR = hexSize * theme.badgeRadiusFactor;
    for (const b of state.buildings) {
      seen.add(b.id);
      const p = hexToPixel(b.hex, hexSize);
      plates.circle(p.x, p.y, radius).fill(playerColor(b.owner)).stroke({
        color: theme.plateRimColor,
        width: theme.plateRimWidth,
        alpha: 0.85,
      });

      let entry = iconTexts.get(b.id);
      if (!entry || entry.type !== b.type) {
        entry?.text.destroy();
        const text = new Text({
          text: BUILDINGS[b.type].icon,
          style: { fontSize: hexSize * theme.iconSizeFactor, fontFamily: theme.fontFamily },
          resolution: 2,
        });
        text.anchor.set(0.5);
        icons.addChild(text);
        entry = { text, type: b.type };
        iconTexts.set(b.id, entry);
      }
      entry.text.position.set(p.x, p.y);

      const city = b.type === 'cityCenter' ? cityById.get(b.id) : undefined;
      if (city) {
        const ring = cityRingStyle(city.level);
        if (ring.outerColor !== null) {
          plates
            .circle(p.x, p.y, radius + ring.outerWidth / 2 + 1)
            .stroke({ color: ring.outerColor, width: ring.outerWidth });
        }
        if (ring.innerColor !== null) {
          plates
            .circle(p.x, p.y, radius - theme.cityInnerRingInset)
            .stroke({ color: ring.innerColor, width: theme.cityInnerRingWidth });
        }
        seenCities.add(city.id);
        let label = residentTexts.get(city.id);
        if (!label) {
          label = new Text({
            text: String(city.residents),
            style: {
              fontSize: hexSize * theme.residentsSizeFactor,
              fontFamily: theme.fontFamily,
              fill: 0xffffff,
              stroke: { color: theme.residentsStrokeColor, width: 3 },
              fontWeight: 'bold',
            },
            resolution: 2,
          });
          label.anchor.set(0.5, 0);
          icons.addChild(label);
          residentTexts.set(city.id, label);
        }
        const str = String(city.residents);
        if (label.text !== str) label.text = str;
        label.position.set(p.x, p.y + radius + 2);
      }

      const kind = badgeKind(statuses[b.id]);
      if (kind) {
        const bx = p.x + radius * 0.75;
        const by = p.y - radius * 0.75;
        badges
          .circle(bx, by, badgeR)
          .fill(kind === 'paused' ? theme.pausedBadgeColor : theme.badgeColor)
          .stroke({ color: theme.plateRimColor, width: 1 });
        if (kind === 'paused') {
          // pause sign: two small bars
          const bw = badgeR * 0.26;
          const bh = badgeR * 0.9;
          badges
            .rect(bx - bw * 1.4, by - bh / 2, bw, bh)
            .rect(bx + bw * 0.4, by - bh / 2, bw, bh)
            .fill(theme.badgeMarkColor);
          continue;
        }
        // "!" drawn from shapes: a bar and a dot
        const w = badgeR * 0.28;
        badges
          .roundRect(bx - w / 2, by - badgeR * 0.6, w, badgeR * 0.75, w / 2)
          .circle(bx, by + badgeR * 0.45, w * 0.65)
          .fill(theme.badgeMarkColor);
      }
    }
    for (const [id, entry] of iconTexts) {
      if (seen.has(id)) continue;
      entry.text.destroy();
      iconTexts.delete(id);
    }
    for (const [id, label] of residentTexts) {
      if (seenCities.has(id)) continue;
      label.destroy();
      residentTexts.delete(id);
    }
  }

  return {
    layers: [tint, border, roads, plates, icons, badges, highlights, preview],
    update(state, statuses) {
      drawTerritory(state);
      drawRoads(state);
      drawBuildings(state, statuses);
    },
    setHighlights(hexes) {
      highlights.clear();
      for (const h of hexes) {
        highlights
          .poly(flatCorners(hexToPixel(h, hexSize)))
          .fill({ color: theme.highlightColor, alpha: theme.highlightFillAlpha })
          .stroke({ color: theme.highlightColor, width: theme.highlightWidth, join: 'round' });
      }
    },
    setPathPreview(path, newTiles) {
      preview.clear();
      if (!path || path.length === 0) return;
      const width = hexSize * theme.previewWidthFactor;
      const pts = path.map((h) => hexToPixel(h, hexSize));
      if (pts.length === 1) {
        preview.circle(pts[0].x, pts[0].y, width * 0.8).fill(theme.previewColor);
      } else {
        preview.moveTo(pts[0].x, pts[0].y);
        for (const p of pts.slice(1)) preview.lineTo(p.x, p.y);
        preview.stroke({ color: theme.previewColor, width, cap: 'round', join: 'round' });
      }
      for (const h of newTiles) {
        const p = hexToPixel(h, hexSize);
        preview.circle(p.x, p.y, hexSize * theme.previewDotRadiusFactor);
      }
      preview.fill(0xffffff);
    },
  };
}
