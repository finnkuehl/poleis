// Wonder crew: pause low-value buildings so the unfinished wonder gets its workers, and
// unpause them once no unfinished wonder is left. The AI pauses nothing else.

import { assignWorkers, connectedBuildingIds, population, workersNeeded } from '../core/rules';
import { aiConfig, BUILDINGS } from '../data';
import type { AiContext } from './context';
import type { Candidate } from './types';

const M = aiConfig.military;

export function wonderCandidates(ctx: AiContext): Candidate[] {
  const { state } = ctx;
  const unfinished = ctx.ownBuildings.find(
    (b) => b.type === 'wonder' && ctx.statusOf.get(b.id) !== 'wonderComplete',
  );
  const out: Candidate[] = [];
  if (!unfinished) {
    for (const b of ctx.ownBuildings) {
      if (b.paused && b.type !== 'wonder') {
        out.push({
          action: { type: 'togglePause', hex: b.hex },
          utility: M.unpauseUtility,
          reason: `unpause ${b.type} (wonder is done)`,
          key: `unpause:${b.id}`,
          once: true,
        });
      }
    }
    return out;
  }
  if (ctx.statusOf.get(unfinished.id) !== 'missingWorkers') return out;
  const assigned = assignWorkers(state, ctx.player, connectedBuildingIds(state, ctx.player));
  let staffed = 0;
  let pausedHere = 0;
  const pausable: { b: (typeof ctx.ownBuildings)[number]; value: number }[] = [];
  for (const b of ctx.ownBuildings) {
    staffed += assigned[b.id] ?? 0;
    if (b.paused) pausedHere += 1;
    const value = M.wonderPauseValue[b.type];
    if (b.type === 'wonder' || b.paused || value === undefined || workersNeeded(b) <= 0) continue;
    if ((assigned[b.id] ?? 0) <= 0) continue;
    pausable.push({ b, value });
  }
  if (pausedHere >= M.wonderMaxPaused) return out;
  const free = population(state, ctx.player) - staffed;
  if (free >= BUILDINGS.wonder.workers) return out;
  pausable.sort((a, b) => a.value - b.value || a.b.id - b.b.id);
  const first = pausable[0];
  if (first) {
    out.push({
      action: { type: 'togglePause', hex: first.b.hex },
      utility: M.pauseUtility,
      reason: `pause ${first.b.type} to staff the wonder`,
      key: `pause:${first.b.id}`,
      once: true,
    });
  }
  return out;
}
