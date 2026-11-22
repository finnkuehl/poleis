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
  alongTrack,
  edgeMaskOf,
  insetRuns,
  previewTrack,
  roadSignature,
  roadTracks,
  territoryEdges,
  trackRibbon,
  type InsetRun,
  type RoadTracks,
  type TrackCrossing,
  type TrackParams,
} from './geometry';
import { playerColorOf } from './playerColor';
import { mineArtTransform } from './relief';
import { badgeKind, cityRingStyle } from './style';
import { ellipsePoints, mixColor, tileHash, tileRng } from './terrain';
import { theme } from './theme';

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
  setHighlights(hexes: readonly Hex[]): void;
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

/** Track sizes from the theme (see geometry.ts `roadTracks`). */
function trackParams(): TrackParams {
  const R = theme.ground.road;
  return {
    width: R.width,
    widthVar: R.widthVar,
    edgeJitter: R.edgeJitter,
    centerJitter: R.centerJitter,
    buildingEnd: R.buildingEnd,
    plazaEnd: R.plazaEnd,
    samples: R.samples,
  };
}

/** Fills all polygons at once (one draw instruction). */
function fillPolys(g: Graphics, polys: readonly number[][], color: number, alpha = 1): void {
  if (polys.length === 0) return;
  for (const p of polys) g.poly(p);
  g.fill({ color, alpha });
}

/**
 * Paints the road tracks (docs/ART.md "Roads: worn dirt tracks"): soft grassy edges fading into
 * the terrain, the earth band, two darker wheel ruts, a grassy middle strip and a few stones;
 * next to a city center light stone paving with edge stones. Junctions overlap into worn
 * crossings. Every layer is one fill.
 */
function paintTracks(g: Graphics, tracks: RoadTracks): void {
  const R = theme.ground.road;
  const dirt = tracks.pieces.filter((t) => t.style === 'dirt');
  const paved = tracks.pieces.filter((t) => t.style === 'paved');
  const spot = (c: TrackCrossing, k: number): number[] =>
    ellipsePoints(
      c.center.x,
      c.center.y,
      c.r * k,
      c.r * k * 0.8,
      12,
      0.12,
      tileRng(c.tile, 0, 310),
    );
  // Soft grassy edges under everything (also under the paving)
  fillPolys(
    g,
    [
      ...tracks.pieces.map((t) => trackRibbon(t.points, t.widths, R.edgeGrow)),
      ...tracks.crossings.map((c) => spot(c, R.edgeGrow)),
    ],
    R.edgeColor,
    R.edgeAlpha,
  );
  // Earth
  fillPolys(
    g,
    [
      ...dirt.map((t) => trackRibbon(t.points, t.widths, 1)),
      ...tracks.crossings.filter((c) => c.style === 'dirt').map((c) => spot(c, 1)),
    ],
    R.earthColor,
    R.earthAlpha,
  );
  // Wheel ruts and the grassy strip between them; in a junction they fade out toward the middle
  // of the curves, so the crossing reads as one worn place
  const rutWidths = (t: (typeof dirt)[number]): number[] =>
    t.widths.map((w, i) => {
      const u = i / (t.widths.length - 1);
      if (t.junction) return w * Math.max(0, 1 - Math.sin(Math.PI * u) * 1.6);
      if (t.yard) return w * Math.max(0, 1 - u * 1.3);
      return w;
    });
  fillPolys(
    g,
    dirt.flatMap((t) =>
      [-1, 1].map((k) => trackRibbon(t.points, rutWidths(t), R.rutWidth, k * R.rutOffset)),
    ),
    R.rutColor,
    R.rutAlpha,
  );
  fillPolys(
    g,
    dirt.map((t) => trackRibbon(t.points, rutWidths(t), R.grassWidth)),
    R.grassColor,
    R.grassAlpha,
  );
  // A few stones and pebbles along the sides
  const stones: number[][][] = R.stoneColors.map(() => []);
  dirt.forEach((t, k) => {
    alongTrack(t.points, t.widths, R.stoneStep * hexSize).forEach(({ p, dir, w }, i) => {
      const hash = tileHash(t.tile, k, i);
      if (hash > R.stoneChance || w < 0.3 * R.width * hexSize) return;
      const side = hash < R.stoneChance / 2 ? 1 : -1;
      const off = w * (0.5 + 0.12 * hash);
      const r = R.stoneSize * hexSize * (0.7 + hash);
      stones[i % stones.length].push(
        ellipsePoints(p.x - dir.y * off * side, p.y + dir.x * off * side, r, r * 0.72, 6),
      );
    });
  });
  R.stoneColors.forEach((color, i) => fillPolys(g, stones[i], color));
  // Light stone paving next to a city center, with edge stones and joints
  fillPolys(
    g,
    [
      ...paved.map((t) => trackRibbon(t.points, t.widths, R.paveWidth)),
      ...tracks.crossings.filter((c) => c.style === 'paved').map((c) => spot(c, 1)),
    ],
    R.paveColor,
  );
  const joints: Point[][] = [];
  const edges: number[][] = [];
  for (const t of paved) {
    for (const { p, dir, w } of alongTrack(t.points, t.widths, R.paveStep * hexSize)) {
      const half = (w * R.paveWidth) / 2;
      joints.push([
        { x: p.x - dir.y * half * 0.85, y: p.y + dir.x * half * 0.85 },
        { x: p.x + dir.y * half * 0.85, y: p.y - dir.x * half * 0.85 },
      ]);
      const r = R.stoneSize * hexSize * 1.15;
      for (const side of [-1, 1]) {
        edges.push(
          ellipsePoints(p.x - dir.y * half * side, p.y + dir.x * half * side, r, r * 0.7, 6),
        );
      }
    }
  }
  if (joints.length > 0) {
    for (const [a, b] of joints) g.moveTo(a.x, a.y).lineTo(b.x, b.y);
    g.stroke({ color: R.paveJoint, width: 0.6, alpha: R.paveJointAlpha, cap: 'butt' });
  }
  fillPolys(g, edges, R.paveEdge);
}

/** `art`: the loaded building art (missing entries fall back to plate + emoji). */
export function createEconomyLayers(art: ArtSet = NO_ART): EconomyLayers {
  const tint = new Graphics();
  const border = new Graphics();
  const roads = new Graphics();
  /** On the ground under the buildings: colored plates and city-level rings. */
  const ground = new Graphics();
  /** Building art and emoji, sorted by row so lower tiles overlap the tile above. */
  const objects = new Container();
  objects.sortableChildren = true;
  /** Resident counts of the cities (above all building art). */
  const labels = new Container();
  const badges = new Graphics();
  const highlights = new Graphics();
  const preview = new Graphics();

  /** One resident-count Text per city id (created/destroyed when cities appear/disappear). */
  const residentTexts = new Map<number, Text>();

  function drawTerritory(state: GameState): void {
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
    }
  }

  /** Key of the road network last painted (the tracks are repainted only when it changes). */
  let roadKey: string | null = null;

  function drawRoads(state: GameState): void {
    const key = roadSignature(state);
    if (key === roadKey) return;
    roadKey = key;
    roads.clear();
    paintTracks(roads, roadTracks(state, hexSize, trackParams()));
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
          labels.addChild(label);
          residentTexts.set(city.id, label);
        }
        const str = String(city.residents);
        if (label.text !== str) label.text = str;
        label.position.set(p.x, p.y + radius + 2);
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
    for (const [id, label] of residentTexts) {
      if (seenCities.has(id)) continue;
      label.destroy();
      residentTexts.delete(id);
    }
  }

  return {
    below: [tint, border, roads, ground, objects, labels, badges],
    sorted: objects,
    above: [highlights, preview],
    update(state, statuses, viewer) {
      drawTerritory(state);
      drawRoads(state);
      drawBuildings(state, statuses, viewer);
    },
    setRevealAll(value) {
      revealAll = value;
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
      const R = theme.ground.road;
      const w = R.width * hexSize;
      if (path.length === 1) {
        const p = hexToPixel(path[0], hexSize);
        preview.circle(p.x, p.y, w * 0.6).fill({ color: R.previewColor, alpha: R.previewAlpha });
      } else {
        // The planned road as a ghost of the real track: the same smooth course, light
        const pts = previewTrack(path, hexSize);
        const widths = pts.map(() => w);
        preview.poly(trackRibbon(pts, widths, R.edgeGrow)).fill({
          color: R.previewColor,
          alpha: R.previewAlpha * 0.45,
        });
        preview
          .poly(trackRibbon(pts, widths, 1))
          .fill({ color: R.previewColor, alpha: R.previewAlpha });
        for (const k of [-1, 1]) {
          preview.poly(trackRibbon(pts, widths, R.rutWidth, k * R.rutOffset)).fill({
            color: theme.previewColor,
            alpha: R.previewAlpha,
          });
        }
      }
      for (const h of newTiles) {
        const p = hexToPixel(h, hexSize);
        preview.circle(p.x, p.y, hexSize * theme.previewDotRadiusFactor);
      }
      preview.fill(0xffffff);
    },
  };
}
