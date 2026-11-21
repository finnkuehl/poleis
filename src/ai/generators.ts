// The list of candidate generators. Each only reads the AiContext and returns candidates.

import { economyCandidates, roadCandidates } from './economy';
import { settlerCandidates } from './settle';
import { trainingCandidates } from './training';
import type { CandidateGenerator } from './types';
import { unitCandidates } from './units';
import { wonderCandidates } from './wonder';

export const GENERATORS: readonly CandidateGenerator[] = [
  roadCandidates,
  economyCandidates,
  trainingCandidates,
  settlerCandidates,
  unitCandidates,
  wonderCandidates,
];
