// Unit commands of the AI: exploring, defending, attacking, capturing, retreating.
// Every unit gets at most one movement command per turn (group `cmd:<id>`) and one attack
// (group `atk:<id>`); both are only offered while the unit can still do them.

import { distance, hexEquals, neighbors, type Hex } from '../core/hex';
import { hexAtIndex, terrainAt, tileIndex } from '../core/map';
import {
  attackTargets,
  combatPreview,
  planMoveOrder,
  reachableTiles,
  type CombatPreview,
  type OrderPlan,
} from '../core/rules';
import type { City, GameState, Unit } from '../core/state';
import { aiConfig, TERRAIN, UNITS } from '../data';
import type { AiContext } from './context';
import { defendersWanted } from './training';
import type { Candidate } from './types';
import {
  freeKnown,
  hpShare,
  isCombat,
  isEnemyCenter,
  landSearch,
  nearestDistance,
  ownCenters,
  ownTerritory,
  strength,
  viewOf,
  type View,
} from './view';

const M = aiConfig.military;

interface Roles {
  /** Defender unit id -> the city it guards. */
  defenders: Map<number, City>;
  /** Combat units that are not defenders. */
  army: Unit[];
  scouts: Unit[];
}

const roleCache = new WeakMap<View, Roles>();

/** Splits the units into roles; stateless: the nearest units to a city defend it. */
function rolesOf(view: View): Roles {
  const cached = roleCache.get(view);
  if (cached) return cached;
  const combat = view.units.filter(isCombat);
  const taken = new Set<number>();
  const defenders = new Map<number, City>();
  for (const ci of view.ctx.cities) {
    const wanted = defendersWanted(view, ci.city);
    const sorted = combat
      .filter((u) => !taken.has(u.id))
      .sort(
        (a, b) => distance(a.hex, ci.city.center) - distance(b.hex, ci.city.center) || a.id - b.id,
      );
    for (const u of sorted.slice(0, wanted)) {
      taken.add(u.id);
      defenders.set(u.id, ci.city);
    }
  }
  const roles: Roles = {
    defenders,
    army: combat.filter((u) => !taken.has(u.id)),
    scouts: view.units.filter((u) => u.type === 'scout'),
  };
  roleCache.set(view, roles);
  return roles;
}

const idx = (view: View, h: Hex): number => tileIndex(view.state.map, h);

/** Can the unit still be given a movement command now? */
function ready(ctx: AiContext, u: Unit): boolean {
  if (u.order || u.attacked || ctx.skip.has(`cmd:${u.id}`)) return false;
  return u.movesLeft > 0 || !u.hasMoved;
}

function cmd(
  u: Unit,
  action: Candidate['action'],
  utility: number,
  reason: string,
  suffix: string,
): Candidate {
  return {
    action,
    utility,
    reason,
    key: `cmd:${u.id}:${suffix}`,
    group: `cmd:${u.id}`,
    once: true,
  };
}

function favorable(p: CombatPreview): boolean {
  return p.damage > 0 && p.damage >= p.counter && !p.attackerDies;
}

/** The fight as if the unit stood on `at` (only the distance for the counterattack changes). */
function previewFrom(state: GameState, u: Unit, at: Hex, target: Unit): CombatPreview {
  const moved: GameState = {
    ...state,
    units: state.units.map((x) => (x.id === u.id ? { ...x, hex: at } : x)),
  };
  return combatPreview(moved, u.id, target.id);
}

/** Would an order of this unit end a turn on an enemy city center in peace time? */
function riskyPlan(view: View, plan: OrderPlan): boolean {
  return view.peace && plan.stops.some((s) => s.turn <= 1 && isEnemyCenter(view, s.hex));
}

function stopsOnEnemyCity(view: View, plan: OrderPlan): boolean {
  return plan.stops.some((s) => s.turn <= 1 && isEnemyCenter(view, s.hex));
}

/** The nearest free tile at or around the nearest own city center. */
function homeTile(view: View, from: Hex): Hex | null {
  const centers = ownCenters(view);
  if (centers.length === 0) return null;
  const center = [...centers].sort((a, b) => distance(a, from) - distance(b, from))[0];
  return [center, ...neighbors(center)].find((h) => freeKnown(view, h)) ?? null;
}

// --- Peace guard ---------------------------------------------------------------------------

function peaceGuard(view: View): Candidate[] {
  if (!view.peace) return [];
  const out: Candidate[] = [];
  const { state, ctx } = view;
  for (const u of view.units) {
    if (u.capturing !== null && ready(ctx, u)) {
      const away = reachableTiles(state, u.id, { ignoreHiddenUnits: true }).find(
        (r) => !isEnemyCenter(view, r.hex),
      );
      if (away) {
        out.push(
          cmd(
            u,
            { type: 'move', unitId: u.id, to: away.hex },
            M.utility.peaceGuard,
            'step off a city (peace)',
            'guard',
          ),
        );
      }
    }
    if (u.order && !ctx.skip.has(`guard:${u.id}`)) {
      const plan = planMoveOrder(state, u.id, u.order.to);
      if (plan.ok && riskyPlan(view, plan.plan)) {
        out.push({
          action: { type: 'cancelOrder', unitId: u.id },
          utility: M.utility.peaceGuard,
          reason: 'order would end on an enemy city (peace)',
          key: `guard:${u.id}`,
          once: true,
        });
      }
    }
  }
  return out;
}

// --- Exploring -----------------------------------------------------------------------------

function exploreCandidates(view: View, roles: Roles): Candidate[] {
  const out: Candidate[] = [];
  const { state, ctx } = view;
  for (const u of roles.scouts) {
    if (!ready(ctx, u)) continue;
    const others = roles.scouts.filter((s) => s.id !== u.id).map((s) => s.order?.to ?? s.hex);
    const { order } = landSearch(view, u.hex);
    let tries = 0;
    for (const i of order) {
      if (tries >= M.frontierTries) break;
      const tile = hexAtIndex(state.map, i);
      if (
        !neighbors(tile).some((n) => {
          const ni = idx(view, n);
          return ni >= 0 && !view.explored[ni];
        })
      )
        continue;
      if (view.occupied.has(i)) continue;
      // Scouts explore; they never stand on an enemy city (that would capture it).
      if (isEnemyCenter(view, tile)) continue;
      if (nearestDistance(tile, others) < M.scoutSpread) continue;
      const plan = planMoveOrder(state, u.id, tile);
      if (!plan.ok || stopsOnEnemyCity(view, plan.plan)) continue;
      out.push(
        cmd(
          u,
          { type: 'setOrder', unitId: u.id, to: tile },
          M.utility.explore - tries,
          'explore',
          `explore:${tile.q},${tile.r}`,
        ),
      );
      tries += 1;
    }
  }
  return out;
}

// --- Defending -----------------------------------------------------------------------------

function defendPosts(view: View, roles: Roles): Candidate[] {
  const out: Candidate[] = [];
  for (const [id, city] of roles.defenders) {
    const u = view.units.find((x) => x.id === id);
    if (!u || !ready(view.ctx, u)) continue;
    if (distance(u.hex, city.center) <= 1) continue;
    const post = [city.center, ...neighbors(city.center)].find((h) => freeKnown(view, h));
    if (!post) continue;
    out.push(
      cmd(
        u,
        { type: 'setOrder', unitId: u.id, to: post },
        M.utility.defendPost,
        'go to the city',
        `post:${post.q},${post.r}`,
      ),
    );
  }
  return out;
}

// --- Fighting ------------------------------------------------------------------------------

function attackCandidates(view: View): Candidate[] {
  if (view.peace) return [];
  const out: Candidate[] = [];
  for (const u of view.units) {
    if (!isCombat(u) || u.attacked || view.ctx.skip.has(`atk:${u.id}`)) continue;
    for (const t of attackTargets(view.state, u.id)) {
      if (!view.visible[idx(view, t.hex)]) continue;
      const p = combatPreview(view.state, u.id, t.id);
      if (!favorable(p)) continue;
      out.push({
        action: { type: 'attack', unitId: u.id, targetId: t.id },
        utility: M.utility.attack + p.damage * 10 - p.counter * 5 + (p.defenderDies ? 100 : 0),
        reason: `attack ${t.type}`,
        key: `atk:${u.id}:${t.id}`,
        group: `atk:${u.id}`,
        once: true,
      });
    }
  }
  return out;
}

interface Offense {
  targets: City[];
  on: boolean;
  /** Army units near the first target. */
  engaged: Unit[];
  active: Unit[];
}

function offenseOf(view: View, roles: Roles): Offense | null {
  if (view.peace || view.enemyCities.length === 0) return null;
  const centers = ownCenters(view);
  const targets = [...view.enemyCities].sort(
    (a, b) =>
      nearestDistance(a.center, centers) - nearestDistance(b.center, centers) || a.id - b.id,
  );
  // Units that are healing in the own territory stay out of the army.
  const active = roles.army.filter((u) => !(hpShare(u) < M.rejoinHp && ownTerritory(view, u.hex)));
  const first = targets[0];
  const engaged = active.filter((u) => distance(u.hex, first.center) <= M.engageRadius);
  const minSize = engaged.length > 0 ? M.armyMinSizeEngaged : M.armyMinSize;
  let enemy = view.visible[idx(view, first.center)] ? 0 : M.assumedCityDefense;
  for (const e of view.enemies) {
    if (e.type === 'settler') continue;
    if (distance(e.hex, first.center) <= M.targetStrengthRadius) enemy += strength(e);
  }
  const mine = active.reduce((sum, u) => sum + strength(u), 0);
  const ratio =
    M.attackRatio[view.ctx.personality] * (engaged.length > 0 ? M.engagedRatioFactor : 1);
  return { targets, on: active.length >= minSize && mine >= ratio * enemy, engaged, active };
}

function armyCandidates(view: View, roles: Roles): Candidate[] {
  const out: Candidate[] = [];
  const { state, ctx } = view;
  const offense = offenseOf(view, roles);
  const activeIds = new Set(offense?.active.map((u) => u.id));
  const engagedIds = new Set(offense?.engaged.map((u) => u.id));
  let k = 0;
  for (const u of roles.army) {
    // Badly wounded and not at home: leave the fight.
    if (ready(ctx, u) && hpShare(u) < M.retreatHp && !ownTerritory(view, u.hex)) {
      const home = homeTile(view, u.hex);
      if (home)
        out.push(
          cmd(
            u,
            { type: 'setOrder', unitId: u.id, to: home },
            M.utility.retreat,
            'retreat',
            'retreat',
          ),
        );
      continue;
    }
    if (!offense || !activeIds.has(u.id)) {
      // Not part of an attack: go home if stuck outside.
      if (ready(ctx, u) && !ownTerritory(view, u.hex) && hpShare(u) < M.rejoinHp) {
        const home = homeTile(view, u.hex);
        if (home)
          out.push(
            cmd(
              u,
              { type: 'setOrder', unitId: u.id, to: home },
              M.utility.goHome,
              'go home to heal',
              'home',
            ),
          );
      }
      continue;
    }
    if (!ready(ctx, u)) continue;
    if (!offense.on && !engagedIds.has(u.id)) {
      if (!ownTerritory(view, u.hex)) {
        const home = homeTile(view, u.hex);
        if (home)
          out.push(
            cmd(
              u,
              { type: 'setOrder', unitId: u.id, to: home },
              M.utility.goHome,
              'go home (no attack)',
              'home',
            ),
          );
      }
      continue;
    }
    if (!offense.on) continue;
    const reach = reachableTiles(state, u.id, { ignoreHiddenUnits: true });
    // Capture an empty enemy city center.
    if (UNITS[u.type].canCapture) {
      for (const c of offense.targets) {
        if (view.occupied.has(idx(view, c.center))) continue;
        if (reach.some((r) => hexEquals(r.hex, c.center))) {
          out.push(
            cmd(
              u,
              { type: 'move', unitId: u.id, to: c.center },
              M.utility.capture,
              'capture the city',
              `capture:${c.id}`,
            ),
          );
        }
      }
    }
    // Step to a spot from which a favorable attack is possible.
    let best: { hex: Hex; value: number; target: Unit } | null = null;
    const range = UNITS[u.type].range;
    for (const e of view.enemies) {
      if (distance(u.hex, e.hex) > 8) continue;
      for (const r of reach) {
        const d = distance(r.hex, e.hex);
        if (d < 1 || d > range) continue;
        const p = previewFrom(state, u, r.hex, e);
        if (!favorable(p)) continue;
        const terrain = terrainAt(state.map, r.hex);
        const cover = (terrain && TERRAIN[terrain].defenseBonus) || 1;
        const value = p.damage - p.counter + cover + (p.defenderDies ? 3 : 0) - r.cost * 0.1;
        if (!best || value > best.value) best = { hex: r.hex, value, target: e };
      }
    }
    if (best && !hexEquals(best.hex, u.hex)) {
      out.push(
        cmd(
          u,
          { type: 'move', unitId: u.id, to: best.hex },
          M.utility.moveToAttack + best.value,
          `move to attack ${best.target.type}`,
          'attackpos',
        ),
      );
    }
    // March towards the target (units already close fight instead).
    const first = offense.targets[0];
    if (distance(u.hex, first.center) > 2) {
      offense.targets.slice(0, 2).forEach((target, t) => {
        const stage = stagingTiles(view, target);
        if (stage.length === 0) return;
        const to = stage[k % stage.length];
        if (hexEquals(to, u.hex)) return;
        out.push(
          cmd(
            u,
            { type: 'setOrder', unitId: u.id, to },
            M.utility.march - t,
            `march on city ${target.id}`,
            `march:${target.id}`,
          ),
        );
      });
    }
    k += 1;
  }
  return out;
}

/** Free tiles next to the target city center, the ones closest to home first. */
function stagingTiles(view: View, target: City): Hex[] {
  const centers = ownCenters(view);
  return neighbors(target.center)
    .filter((h) => freeKnown(view, h))
    .sort(
      (a, b) =>
        nearestDistance(a, centers) - nearestDistance(b, centers) || idx(view, a) - idx(view, b),
    );
}

/** All unit candidates of the AI (settlers have their own generator). */
export function unitCandidates(ctx: AiContext): Candidate[] {
  const view = viewOf(ctx);
  const roles = rolesOf(view);
  return [
    ...peaceGuard(view),
    ...exploreCandidates(view, roles),
    ...defendPosts(view, roles),
    ...attackCandidates(view),
    ...armyCandidates(view, roles),
  ];
}
