import { queueService } from '@/modules/queue/QueueService';
import { fairnessRanker, FairnessRanker } from '@/modules/matchmaking/FairnessRanker';
import { buildDoublesBalancedMatch } from '@/modules/matchmaking/strategies/doublesBalanced';
import { buildMixedDoublesMatch } from '@/modules/matchmaking/strategies/mixedDoubles';
import { buildSameGenderDoublesMatch } from '@/modules/matchmaking/strategies/sameGenderDoubles';
import { buildSinglesMatch } from '@/modules/matchmaking/strategies/singles';
import { MatchmakingRequest } from '@/modules/matchmaking/types';
import { QueueEntry } from '@/types/queue';

/** Authoritative Find Match pipeline — pool filter → fairness → DUPR strategy. */
export class MatchmakingService {
  constructor(private readonly ranker: FairnessRanker = fairnessRanker) {}

  buildMatch(request: MatchmakingRequest): QueueEntry | null {
    const available = queueService.getAvailablePlayers(request.players, request.queueState);
    const context = this.ranker.createContext(request.sessionSettings);

    if (request.courtFormat === 'singles') {
      return buildSinglesMatch(available, context, this.ranker);
    }

    switch (request.matchMode) {
      case 'mixed_doubles':
        return buildMixedDoublesMatch(available, context, this.ranker);
      case 'same_gender':
        return buildSameGenderDoublesMatch(available, context, this.ranker);
      default:
        return buildDoublesBalancedMatch(available, context, this.ranker);
    }
  }
}

export const matchmakingService = new MatchmakingService();
