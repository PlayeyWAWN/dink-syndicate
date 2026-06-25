import type { MatchDuprMeta } from '@/types/queue';
import type { PlayerDuprProfile } from '@/types/player';
import type { Unsubscribe } from '@/types/session';

export interface DuprRating {
  doubles?: number;
  singles?: number;
  source: PlayerDuprProfile['duprRatingSource'];
  syncedAt?: number;
}

/** Phase 3 DUPR RaaS backend contract — stubbed in Phase 1. */
export interface DuprProvider {
  connectPlayer(): Promise<void>;
  getRating(duprId: string): Promise<DuprRating>;
  submitMatch(match: MatchDuprMeta): Promise<void>;
  onRatingUpdate(callback: (duprId: string, rating: DuprRating) => void): Unsubscribe;
  isAvailable(): boolean;
}
