// The list of candidate generators. Step 3b adds the military ones (training, exploring,
// settlers, attacks) here; each generator only reads the AiContext and returns candidates.

import { economyCandidates, roadCandidates } from './economy';
import type { CandidateGenerator } from './types';

export const GENERATORS: readonly CandidateGenerator[] = [roadCandidates, economyCandidates];
