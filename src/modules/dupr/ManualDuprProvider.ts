import type { DuprProvider, DuprRating } from '@/modules/dupr/DuprProvider';
import type { MatchDuprMeta } from '@/types/queue';
import type { Unsubscribe } from '@/types/session';

/** Offline-safe stub — manual organizer ratings only until Phase 3 RaaS. */
export class ManualDuprProvider implements DuprProvider {
  isAvailable(): boolean {
    return false;
  }

  async connectPlayer(): Promise<void> {
    throw new Error('DUPR SSO is not available until Phase 3');
  }

  async getRating(_duprId: string): Promise<DuprRating> {
    throw new Error('DUPR ratings API is not available until Phase 3');
  }

  async submitMatch(_match: MatchDuprMeta): Promise<void> {
    throw new Error('DUPR match upload is not available until Phase 3');
  }

  onRatingUpdate(_callback: (duprId: string, rating: DuprRating) => void): Unsubscribe {
    return () => undefined;
  }
}

export const duprProvider: DuprProvider = new ManualDuprProvider();
