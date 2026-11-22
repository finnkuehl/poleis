// Dynamic map layers: territory, roads, buildings, status badges, highlights, road preview.
import { Container, Graphics, Text, type Sprite } from 'pixi.js';
import { hexCorners, hexToPixel, type Hex, type Point } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import type { BuildingStatus } from '../core/rules/production';
import type { GameState, PlayerId } from '../core/state';
import { BUILDINGS, type BuildingId, type CityLevel } from '../data';
import { createArtObject, NO_ART, type ArtSet } from './art';
import {
  EDGE_ART_BUILDINGS,
  artModeOf,
  buildingArtId,
  depthKey,
  drawsOwnerDisc,
  groundRingEllipse,
  slopeArtId,
  type ArtMode,
  type ArtPlacement,
} from './artLayout';
import { hexSize } from './config';
import { buildingsShownTo } from './fog';
import { jettyEdge } from './groundworks';
import {
  cityEdges,
  edgeMaskOf,
  edgeNeighborHex,
  insetRuns,
  territoryEdges,
  type InsetRun,
} from './geometry';
import { playerColorOf } from './playerColor';
import { mineArtTransform } from './relief';
import { createRoadLayer } from './roadLayer';
import { badgeKind, cityRingStyle } from './style';
import { mixColor } from './terrain';
import { theme } from './theme';
import { cityName } from '../i18n/cityNames';

export interface EconomyLayers {
  /**
   * Layers below the units, in drawing order. One of them is `sorted`: the building art, sorted
   * by depthKey (other objects that must sort with the buildings, like the terrain rows, are
   * added there too).
   */
  below: Container[];
  /** The container that sorts the building art by row (zIndex = depthKey). */
  sorted: Container;
  /** Layers above the units (highlights, road preview), in drawing order. */
  above: Container[];
  /** Buildings (with rings, labels, badges) only on tiles `viewer` has explored. */
  update(state: GameState, statuses: Record<number, BuildingStatus>, viewer: PlayerId): void;
  /** Test option: buildings on every tile (no fog). Takes effect on the next update. */
  setRevealAll(value: boolean): void;
  /** `board`: tiles that also get an anchor marker (boarding a ship). */
  setHighlights(hexes: readonly Hex[], board?: readonly Hex[]): void;
  setPathPreview(path: readonly Hex[] | null, newTiles: readonly Hex[]): void;
}

function flatCorners(c: Point): number[] {
  return hexCorners(c, hexSize).flatMap((p) => [p.x, p.y]);
}

/** Strokes inset lines (closed rings get a proper join instead of two caps). */
function strokeRuns(
  g: Graphics,
  runs: readonly InsetRun[],
  style: { color: number; width: number; alpha?: number },
): void {
  if (runs.length === 0) return;
  for (const { points, closed } of runs) {
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    if (closed) g.closePath();
  }
  g.stroke({ ...style, cap: 'round', join: 'round' });
}

/** `a`-`b` shortened by `margin` at both ends. */
function trimLine(a: Point, b: Point, margin: number): [Point, Point] {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const k = len > 2 * margin ? margin / len : 0.5;
  return [
    { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k },
    { x: b.x - (b.x - a.x) * k, y: b.y - (b.y - a.y) * k },
  ];
}

/** Dash segments along `a`-`b`, centered so both ends look alike. */
function dashes(a: Point, b: Point, dash: number, gap: number): [Point, Point][] {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len <= dash) return [[a, b]];
  const n = Math.max(1, Math.floor((len + gap) / (dash + gap)));
  const used = n * dash + (n - 1) * gap;
  const start = (len - used) / 2;
  const at = (t: number): Point => ({
    x: a.x + ((b.x - a.x) * t) / len,
    y: a.y + ((b.y - a.y) * t) / len,
  });
  const out: [Point, Point][] = [];
  for (let i = 0; i < n; i++) {
    const t0 = start + i * (dash + gap);
    out.push([at(t0), at(t0 + dash)]);
  }
  return out;
}

/** A city's name banner: parchment ribbon with tails in the owner color, and its text. */
interface CityBanner {
  root: Container;
  ribbon: Graphics;
  text: Text;
  /** Text and color it was last drawn with. */
  key: string;
}

function createCityBanner(): CityBanner {
  const B = theme.cityBanner;
  const root = new Container();
  const ribbon = new Graphics();
  const text = new Text({
    text: '',
    style: {
      fontSize: hexSize * B.fontSizeFactor,
      fontFamily: theme.fontFamily,
      fill: B.textColor,
      fontWeight: 'bold',
    },
    resolution: 3,
  });
  text.anchor.set(0.5, 0.5);
  root.addChild(ribbon, text);
  return { root, ribbon, text, key: '' };
}

/** Redraws the banner when its text or the owner color changed. */
function updateCityBanner(banner: CityBanner, label: string, color: number): void {
  const key = `${label}|${color}`;
  if (banner.key === key) return;
  banner.key = key;
  const B = theme.cityBanner;
  banner.text.text = label;
  const h = hexSize * (B.fontSizeFactor * 1.2 + 2 * B.padY);
  const w = banner.text.width + 2 * hexSize * B.padX;
  const tail = hexSize * B.tail;
  const notch = hexSize * B.notch;
  const tailColor = mixColor(color, 0x000000, 1 - B.tailDarken);
  const g = banner.ribbon;
  g.clear();
  // Swallow-tail ends behind the body, a little lower (a ribbon wrapped around)
  const y0 = h * 0.28;
  const y1 = h * 1.12;
  for (const side of [-1, 1]) {
    const inner = side * (w / 2 - 2);
    const outer = side * (w / 2 + tail);
    g.poly([inner, y0, outer, y0, outer - side * notch, (y0 + y1) / 2, outer, y1, inner, y1]).fill(
      tailColor,
    );
  }
  g.roundRect(-w / 2, 0, w, h, h * 0.3)
    .fill({ color: B.fill, alpha: B.fillAlpha })
    .stroke({ color, width: B.borderWidth });
  banner.text.position.set(0, h / 2);
}

/** `art`: the loaded building art (missing entries fall back to plate + emoji). */
export function createEconomyLayers(art: ArtSet = NO_ART): EconomyLayers {
  const tint = new Graphics();
  const border = new Graphics();
  /** Gravel tracks and paving (textured meshes, see roadLayer.ts), and the planned road */
  const roads = createRoadLayer(hexSize);
  /** On the ground under the buildings: colored plates and city-level rings. */
  const ground = new Graphics();
  /** Building art and emoji, sorted by row so lower tiles overlap the tile above. */
  const objects = new Container();
  objects.sortableChildren = true;
  /** Name banners of the cities (above all building art). */
  const labels = new Container();
  const badges = new Graphics();
  const highlights = new Graphics();

  /** One name banner per city id (created/destroyed when cities appear/disappear). */
  const banners = new Map<number, CityBanner>();

  function drawTerritory(state: GameState, viewer: PlayerId): void {
    tint.clear();
    border.clear();
    const players = new Set<number>();
    for (const o of state.territory) if (o >= 0) players.add(o);
    for (const player of players) {
      const color = playerColorOf(state, player);
      for (let i = 0; i < state.territory.length; i++) {
        if (state.territory[i] !== player) continue;
        tint.poly(flatCorners(hexToPixel(hexAtIndex(state.map, i), hexSize)));
      }
      tint.fill({ color, alpha: theme.territoryTintAlpha });
      // Double line: colored border (with a dark rim) just inside the edge, thin light line further in.
      // Lines are chained per tile and meet the neighbor tile's lines exactly (see insetRuns).
      const outer: InsetRun[] = [];
      const inner: InsetRun[] = [];
      for (const { tile, edges } of territoryEdges(state, player)) {
        const c = hexToPixel(hexAtIndex(state.map, tile), hexSize);
        const corners = hexCorners(c, hexSize);
        const mask = edgeMaskOf(edges);
        outer.push(...insetRuns(c, corners, mask, theme.territoryBorderInset));
        inner.push(...insetRuns(c, corners, mask, theme.territoryInnerLineInset));
      }
      const width = theme.territoryBorderWidth;
      strokeRuns(border, outer, {
        color: mixColor(color, theme.outlineColor, theme.territoryBorderRimMix),
        width: width + theme.territoryBorderRimExtra,
      });
      strokeRuns(border, outer, { color, width, alpha: theme.territoryBorderAlpha });
      strokeRuns(border, inner, {
        color: theme.territoryInnerLineColor,
        width: theme.territoryInnerLineWidth,
        alpha: theme.territoryInnerLineAlpha,
      });
      drawCityBorders(state, player, color, viewer);
    }
  }

  /**
   * Fine dashed lines between the cities of `player` (which land belongs to which city), only
   * where the viewer has explored both tiles.
   */
  function drawCityBorders(state: GameState, player: PlayerId, color: number, viewer: PlayerId) {
    const B = theme.cityBorder;
    const explored = revealAll ? null : state.players.find((p) => p.id === viewer)?.explored;
    const seen = (i: number): boolean => explored === null || explored?.[i] === true;
    const lines: Point[][] = [];
    for (const { tile, edges } of cityEdges(state, player)) {
      const h = hexAtIndex(state.map, tile);
      const corners = hexCorners(hexToPixel(h, hexSize), hexSize);
      for (const e of edges) {
        const n = tileIndex(state.map, edgeNeighborHex(h, e));
        if (!seen(tile) || !seen(n)) continue;
        lines.push(trimLine(corners[e], corners[(e + 1) % 6], B.endMargin * hexSize));
      }
    }
    if (lines.length === 0) return;
    const light = mixColor(color, 0xffffff, B.lightMix);
    const soft = mixColor(color, theme.outlineColor, B.softMix);
    for (const [a, b] of lines) border.moveTo(a.x, a.y).lineTo(b.x, b.y);
    border.stroke({ color: soft, width: B.softWidth, alpha: B.softAlpha, cap: 'round' });
    for (const [a, b] of lines) {
      for (const [d0, d1] of dashes(a, b, B.dash * hexSize, B.gap * hexSize)) {
        border.moveTo(d0.x, d0.y).lineTo(d1.x, d1.y);
      }
    }
    border.stroke({ color: light, width: B.width, alpha: B.alpha, cap: 'round' });
  }

  /** Visuals of one building, created/destroyed only when buildings appear/disappear. */
  interface BuildingVisual {
    type: string;
    /** Art used: the building id or one of its direction versions (e.g. 'fishery.e1'). */
    artId: string;
    mode: ArtMode;
    style: ArtPlacement['style'] | null;
    /** Art container [owner layer, art] or the fallback emoji; sorted as one piece. */
    root: Container;
    accent: Sprite | null;
  }
  const visuals = new Map<number, BuildingVisual>();

  /**
   * Which art a building uses: the fishery scene facing its jetty edge (fishery.e0-e5), a mine or
   * quarry on hills / mountains its slope version, falling back to its own art when there is no
   * water edge or that version did not load.
   */
  function artIdOf(state: GameState, type: BuildingId, hex: Hex): string {
    const edge = EDGE_ART_BUILDINGS.includes(type) ? jettyEdge(state.map, hex) : null;
    // A mine or quarry on hills / mountains: the slope version (the terrain cuts the rock)
    const terrain = state.map.tiles[tileIndex(state.map, hex)];
    return buildingArtId(type, edge, (id) => art.buildings[id] !== undefined, terrain);
  }

  function createVisual(type: BuildingId, artId: string, hex: Hex): BuildingVisual {
    const asset = art.buildings[artId];
    const mode = artModeOf(asset);
    let visual: BuildingVisual;
    if (asset) {
      const { root, accent } = createArtObject(asset);
      visual = { type, artId, mode, style: asset.placement.style, root, accent };
    } else {
      const icon = new Text({
        text: BUILDINGS[type].icon,
        style: { fontSize: hexSize * theme.iconSizeFactor, fontFamily: theme.fontFamily },
        resolution: 2,
      });
      icon.anchor.set(0.5);
      visual = { type, artId, mode, style: null, root: icon, accent: null };
    }
    objects.addChild(visual.root);
    visual.root.zIndex = depthKey(hex);
    return visual;
  }

  /** City-level rings: circles around the plate, or a flat ellipse on the ground around diorama art. */
  function drawCityRings(p: Point, level: CityLevel, diorama: boolean, radius: number): void {
    const ring = cityRingStyle(level);
    if (!diorama) {
      if (ring.outerColor !== null) {
        ground
          .circle(p.x, p.y, radius + ring.outerWidth / 2 + 1)
          .stroke({ color: ring.outerColor, width: ring.outerWidth });
      }
      if (ring.innerColor !== null) {
        ground
          .circle(p.x, p.y, radius - theme.cityInnerRingInset)
          .stroke({ color: ring.innerColor, width: theme.cityInnerRingWidth });
      }
      return;
    }
    const { cy, rx, ry } = groundRingEllipse(hexSize, theme.cityArtRingGap, ring.outerWidth);
    if (ring.outerColor !== null) {
      ground
        .ellipse(p.x, p.y + cy, rx, ry)
        .stroke({ color: ring.outerColor, width: ring.outerWidth });
    }
    if (ring.innerColor !== null) {
      // Second ring outside the first one: an inner ring would be hidden by the building.
      const d = ring.outerWidth / 2 + theme.cityArtSecondRingGap + theme.cityInnerRingWidth / 2;
      ground
        .ellipse(p.x, p.y + cy, rx + d, ry + d)
        .stroke({ color: ring.innerColor, width: theme.cityInnerRingWidth });
    }
  }

  function drawBadge(bx: number, by: number, kind: 'problem' | 'paused'): void {
    const badgeR = hexSize * theme.badgeRadiusFactor;
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
      return;
    }
    // "!" drawn from shapes: a bar and a dot
    const w = badgeR * 0.28;
    badges
      .roundRect(bx - w / 2, by - badgeR * 0.6, w, badgeR * 0.75, w / 2)
      .circle(bx, by + badgeR * 0.45, w * 0.65)
      .fill(theme.badgeMarkColor);
  }

  /** Test option: show buildings on unexplored tiles too. */
  let revealAll = false;

  function drawBuildings(
    state: GameState,
    statuses: Record<number, BuildingStatus>,
    viewer: PlayerId,
  ): void {
    ground.clear();
    badges.clear();
    const seen = new Set<number>();
    const seenCities = new Set<number>();
    const cityById = new Map(state.cities.map((c) => [c.id, c]));
    const radius = hexSize * theme.plateRadiusFactor;
    // Buildings on unexplored tiles get no visuals at all (removed below like demolished ones)
    for (const b of buildingsShownTo(state, viewer, revealAll)) {
      seen.add(b.id);
      const p = hexToPixel(b.hex, hexSize);
      const color = playerColorOf(state, b.owner);

      let v = visuals.get(b.id);
      const artId = artIdOf(state, b.type, b.hex);
      if (!v || v.type !== b.type || v.artId !== artId) {
        // destroy() keeps the shared textures (only Text frees its own)
        v?.root.destroy({ children: true });
        v = createVisual(b.type, artId, b.hex);
        visuals.set(b.id, v);
      }
      // A mine on a slope stands at the mountain's (hill's) outer foot, bigger: the same move
      // and scale as its cut face in the terrain (relief.ts mineArtTransform)
      const mine = v.artId === slopeArtId('mine');
      const shift = mine ? mineArtTransform(hexSize) : { x: 0, y: 0, scale: 1 };
      v.root.position.set(p.x + shift.x, p.y + shift.y);
      v.root.scale.set(shift.scale);
      // Owner color (changes when a city is captured)
      if (v.accent) v.accent.tint = color;
      const diorama = v.style === 'diorama';

      if (drawsOwnerDisc(v.mode)) {
        ground.circle(p.x, p.y, radius).fill(color).stroke({
          color: theme.plateRimColor,
          width: theme.plateRimWidth,
          alpha: 0.85,
        });
      }

      const city = b.type === 'cityCenter' ? cityById.get(b.id) : undefined;
      if (city) {
        drawCityRings(p, city.level, diorama, radius);
        seenCities.add(city.id);
        let banner = banners.get(city.id);
        if (!banner) {
          banner = createCityBanner();
          labels.addChild(banner.root);
          banners.set(city.id, banner);
        }
        updateCityBanner(
          banner,
          `${cityName(city.nameIndex)}${theme.cityBanner.separator}${city.residents}`,
          color,
        );
        banner.root.position.set(p.x, p.y + hexSize * theme.cityBanner.offsetY);
      }

      const kind = badgeKind(statuses[b.id]);
      if (kind) {
        if (diorama) {
          drawBadge(
            p.x + hexSize * theme.badgeArtOffsetXFactor,
            p.y + hexSize * theme.badgeArtOffsetYFactor,
            kind,
          );
        } else {
          drawBadge(p.x + radius * 0.75, p.y - radius * 0.75, kind);
        }
      }
    }
    for (const [id, v] of visuals) {
      if (seen.has(id)) continue;
      v.root.destroy({ children: true });
      visuals.delete(id);
    }
    for (const [id, banner] of banners) {
      if (seenCities.has(id)) continue;
      banner.root.destroy({ children: true });
      banners.delete(id);
    }
  }

  /** An anchor inside a ring: marks the tile of an own ship a unit can board. */
  function drawAnchorMark(g: Graphics, center: { x: number; y: number }): void {
    // At the top of the tile, so the ship's token stays visible
    const c = { x: center.x, y: center.y - hexSize * theme.boardMark.offsetFactor };
    const r = hexSize * theme.boardMark.radiusFactor;
    const color = theme.boardMark.color;
    const w = theme.boardMark.width;
    g.circle(c.x, c.y, r).fill({
      color: theme.boardMark.backColor,
      alpha: theme.boardMark.backAlpha,
    });
    g.circle(c.x, c.y, r).stroke({ color, width: w });
    // Shank, stock, ring on top, and the curved arms at the bottom
    const a = r * 0.55;
    g.moveTo(c.x, c.y - a)
      .lineTo(c.x, c.y + a * 0.8)
      .stroke({ color, width: w, cap: 'round' });
    g.moveTo(c.x - a * 0.5, c.y - a * 0.4)
      .lineTo(c.x + a * 0.5, c.y - a * 0.4)
      .stroke({ color, width: w, cap: 'round' });
    g.circle(c.x, c.y - a * 1.1, a * 0.18).stroke({ color, width: w * 0.8 });
    g.moveTo(c.x - a * 0.7, c.y + a * 0.2)
      .quadraticCurveTo(c.x - a * 0.6, c.y + a * 0.85, c.x, c.y + a * 0.85)
      .quadraticCurveTo(c.x + a * 0.6, c.y + a * 0.85, c.x + a * 0.7, c.y + a * 0.2)
      .stroke({ color, width: w, cap: 'round' });
  }

  return {
    below: [tint, border, roads.roads, ground, objects, labels, badges],
    sorted: objects,
    above: [highlights, roads.preview],
    update(state, statuses, viewer) {
      drawTerritory(state, viewer);
      // Repaints only when the road network (as the viewer may see it) changed
      roads.update(state, viewer, revealAll);
      drawBuildings(state, statuses, viewer);
    },
    setRevealAll(value) {
      revealAll = value;
    },
    setHighlights(hexes, board = []) {
      highlights.clear();
      for (const h of board) drawAnchorMark(highlights, hexToPixel(h, hexSize));
      for (const h of hexes) {
        highlights
          .poly(flatCorners(hexToPixel(h, hexSize)))
          .fill({ color: theme.highlightColor, alpha: theme.highlightFillAlpha })
          .stroke({ color: theme.highlightColor, width: theme.highlightWidth, join: 'round' });
      }
    },
    setPathPreview(path, newTiles) {
      // The planned road as a ghost of the real track: the same look, lighter
      roads.setPreview(path, newTiles);
    },
  };
}
