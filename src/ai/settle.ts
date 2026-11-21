// Settlers: when to send one out, where to found the new city, and walking there.

import { distance, hexEquals, range, type Hex } from '../core/hex';
import { hexAtIndex, inBounds, terrainAt, tileIndex } from '../core/map';
import { advanceCheck, checkFoundCity } from '../core/rules';
import type { City, Unit } from '../core/state';
import { aiConfig, militaryConfig, type TerrainId } from '../data';
import type { AiContext } from './context';
import type { Candidate } from './types';
import { landSearch, nearestDistance, ownCenters, viewOf, walkable, type View } from './view';

const M = aiConfig.military;

export interface Site {
  hex: Hex;
  score: number;
}

/** Terrain value of a tile for a site (coastal plains count as the coast's value, too). */
function tileValue(t: TerrainId | undefined): number {
  return t ? M.settleTileValue[t] : 0;
}

function siteScore(view: View, h: Hex, pathSteps: number): number {
  const { state } = view;
  let score = 0;
  for (const t of range(h, 2)) {
    if (!inBounds(state.map, t)) continue;
    const owner = state.territory[tileIndex(state.map, t)];
    if (owner !== -1 && owner !== view.me) continue;
    score += tileValue(terrainAt(state.map, t));
  }
  const ownDist = nearestDistance(h, ownCenters(view));
  score -= Math.abs(ownDist - M.settlePreferredDistance) * M.settleDistancePenalty;
  score -= pathSteps * M.settlePathPenalty;
  for (const c of view.enemyCities) {
    const d = distance(c.center, h);
    if (d < M.settleEnemyDistance) score -= (M.settleEnemyDistance - d) * M.settleEnemyPenalty;
  }
  return score;
}

/**
 * The best places to found a city, best first (at most `limit`), reachable over explored land
 * from `from`. Only uses explored tiles and known cities.
 */
export function settleSites(view: View, from: Hex, limit = M.settleTries): Site[] {
  const { state } = view;
  const { dist, order } = landSearch(view, from);
  const start = tileIndex(state.map, from);
  const centers = [...ownCenters(view), ...view.enemyCities.map((c) => c.center)];
  const buildingTiles = new Set(state.buildings.map((b) => tileIndex(state.map, b.hex)));
  const sites: (Site & { index: number })[] = [];
  const consider = (i: number): void => {
    const h = hexAtIndex(state.map, i);
    if (terrainAt(state.map, h) !== 'plains') return;
    if (buildingTiles.has(i) || state.roads[i]) return;
    const owner = state.territory[i];
    if (owner !== -1 && owner !== view.me) return;
    if (nearestDistance(h, centers) < militaryConfig.foundMinDistance) return;
    if (nearestDistance(h, ownCenters(view)) > M.settleMaxDistance) return;
    const score = siteScore(view, h, dist[i]);
    if (score >= M.settleMinScore) sites.push({ hex: h, score, index: i });
  };
  if (start >= 0 && walkable(state, from)) consider(start);
  for (const i of order) consider(i);
  sites.sort((a, b) => b.score - a.score || a.index - b.index);
  return sites.slice(0, limit).map(({ hex, score }) => ({ hex, score }));
}

/** Settlers alive plus ordered. */
export function settlerCount(ctx: AiContext): number {
  return (
    ctx.state.units.filter((u) => u.owner === ctx.player && u.type === 'settler').length +
    ctx.state.training.filter((t) => t.owner === ctx.player && t.unit === 'settler').length
  );
}

/** May a settler be sent out from this city now (all conditions except the site)? */
export function mayExpandFrom(ctx: AiContext, city: City): boolean {
  if (ctx.cities.length + settlerCount(ctx) >= M.maxCities[ctx.personality]) return false;
  if (city.residents < M.expandMinResidents) return false;
  const waiting = ctx.cities.some((c) => {
    const check = advanceCheck(ctx.state, c.city.id);
    return check !== null && check.to !== null && check.residents.ok && !check.canAdvance;
  });
  if (waiting && city.residents < M.expandWaitResidents) return false;
  // The food must carry the settler and everybody else.
  return ctx.foodProd - (ctx.foodNeed - ctx.unitCount) >= M.expandMinFoodNet;
}

/** Walking to the site and founding the city, for every own settler that can act. */
export function settlerCandidates(ctx: AiContext): Candidate[] {
  const view = viewOf(ctx);
  const out: Candidate[] = [];
  for (const u of view.units) {
    if (u.type !== 'settler' || u.order || u.attacked) continue;
    const group = `cmd:${u.id}`;
    if (ctx.skip.has(group)) continue;
    const sites = settleSites(view, u.hex);
    if (sites.length > 0 && hexEquals(sites[0].hex, u.hex) && foundOk(view, u)) {
      out.push(found(u, 'found the city at the chosen site', M.utility.foundCity));
      continue;
    }
    if (sites.length === 0) {
      // No good site: do not waste the settler on a bad one, but do not carry it around forever.
      if (foundOk(view, u)) out.push(found(u, 'found the city (no better site)', 200));
      continue;
    }
    sites.forEach((site, k) => {
      if (hexEquals(site.hex, u.hex)) return;
      out.push({
        action: { type: 'setOrder', unitId: u.id, to: site.hex },
        utility: M.utility.settleWalk - k,
        reason: `settler walks to ${site.hex.q},${site.hex.r}`,
        key: `cmd:${u.id}:settle:${site.hex.q},${site.hex.r}`,
        group,
        once: true,
      });
    });
  }
  return out;
}

function foundOk(view: View, u: Unit): boolean {
  return checkFoundCity(view.state, view.me, u.id) === null;
}

function found(u: Unit, reason: string, utility: number): Candidate {
  return {
    action: { type: 'foundCity', unitId: u.id },
    utility,
    reason,
    key: `cmd:${u.id}:found`,
    group: `cmd:${u.id}`,
    once: true,
  };
}
