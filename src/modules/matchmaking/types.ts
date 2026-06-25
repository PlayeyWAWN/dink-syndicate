import { CourtFormat, QueueMatchMode } from '@/config/queue-match-modes';
import { Player } from '@/types/player';
import { QueueState } from '@/types/queue';

import { MATCHMAKING_FAIRNESS } from '@/config/matchmaking';
import { AppSettings } from '@/types/app-data';

/** Session timing for arrival penalty in Find Match. */
export type SessionSettings = Pick<
  AppSettings,
  'sessionStartTime' | 'arrivalGraceMinutes' | 'arrivalPenaltyEnabled' | 'lateMinutesWeight'
>;

export interface MatchmakingRequest {
  courtFormat: CourtFormat;
  matchMode: QueueMatchMode;
  players: Player[];
  queueState: QueueState;
  sessionSettings?: SessionSettings;
}

export interface MatchmakingContext {
  sessionStartTime?: number;
  arrivalGraceMinutes: number;
  arrivalPenaltyEnabled: boolean;
  lateMinutesWeight: number;
}

export interface BalancedQuartetResult {
  teamA: string[];
  teamB: string[];
  score: number;
}

export interface BalancedPairResult {
  playerA: string;
  playerB: string;
  score: number;
}
