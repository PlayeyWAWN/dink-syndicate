/** DUPR balance thresholds — single source for matchmaking strategies. */
export const MATCHMAKING_DUPR = {
  maxInternalGap: 1.5,
  maxInternalGapMirror: 2.5,
  maxTeamAvgDiff: 0.75,
  maxTeamAvgDiffMirror: 1.0,
  maxOverallSpan: 2.5,
  maxOverallSpanMirror: 3.5,
  singlesMaxGap: 1.5,
  singlesMaxGapMirror: 2.5,
  mirrorEpsilon: 0.01,
} as const;

/** Fairness + arrival penalty weights (Phase 3 settings stub defaults). */
export const MATCHMAKING_FAIRNESS = {
  gamesPlayedWeight: 1000,
  lateMinutesWeight: 10,
  defaultGraceMinutes: 10,
  defaultArrivalPenaltyEnabled: false,
  defaultAvailableWaitWarnMinutes: 10,
  defaultAvailableWaitCriticalMinutes: 15,
} as const;

/**
 * Search limits for combinatorial strategies.
 * Smash Syndicate caps exhaustive balanced search at 32; Mix mode uses top-2 per gender
 * with a small fallback window (see maxMixedCandidatesPerGender).
 */
export const MATCHMAKING_LIMITS = {
  maxDoublesCandidates: 32,
  maxSameGenderCandidates: 32,
  maxSinglesCandidates: 32,
  /** Per-gender pool for mixed doubles fallback search (C(8,2)² = 784 max). */
  maxMixedCandidatesPerGender: 8,
} as const;
