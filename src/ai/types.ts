// Shared types of the AI.

import type { Action } from '../core/actions';
import type { Goods } from '../data';
import type { AiContext } from './context';

/** One thing the AI could do now, with its score. */
export interface Candidate {
  /** What to do. null = a pure reservation: keep the `cost` goods for something not doable yet. */
  action: Action | null;
  utility: number;
  /** Why (for debugging and tests, not shown to the player). */
  reason: string;
  /** Stable key: a failed action is not tried again this turn. */
  key: string;
  /** Goods the action spends (checked against the stock before it is tried). */
  cost?: Goods;
  /** If it cannot be done yet, keep these goods for it (lower-scoring actions may not use them). */
  reserve?: boolean;
  /** Income buildings may use reserved goods (they bring the missing goods in). */
  bypassReserve?: boolean;
  /** After it was applied once this turn, it (and its `group`) is not offered again. */
  once?: boolean;
  /** Candidates of one group exclude each other once one of them was applied (with `once`). */
  group?: string;
}

/** Produces candidates from the current situation. Step 3b adds military generators here. */
export type CandidateGenerator = (ctx: AiContext) => Candidate[];
