import { MatchService } from '@/modules/match/MatchService';
import { applyCompletedMatchCorrection } from '@/modules/queue/CompletedMatchService';
import { createPlayer } from '@/types/player';
import { Match, QueueState } from '@/types/queue';

describe('MatchService.revertStats', () => {
  const service = new MatchService();

  it('undoes applyStats for session and career counters', () => {
    const players = [
      { ...createPlayer({ id: 'p1', name: 'A' }), gamesPlayed: 2, wins: 2, losses: 0, career: { gamesPlayed: 5, wins: 4, losses: 1 } },
      { ...createPlayer({ id: 'p2', name: 'B' }), gamesPlayed: 1, wins: 0, losses: 1, career: { gamesPlayed: 3, wins: 1, losses: 2 } },
    ];

    const match: Match = {
      id: 'm1',
      courtId: 'c1',
      playerIds: ['p1', 'p2'],
      format: 'singles',
      status: 'completed',
      winnerPlayerIds: ['p1'],
      completedAt: Date.now(),
    };

    const reverted = service.revertStats(players, match);
    expect(reverted[0]?.gamesPlayed).toBe(1);
    expect(reverted[0]?.wins).toBe(1);
    expect(reverted[0]?.career.gamesPlayed).toBe(4);
    expect(reverted[1]?.losses).toBe(0);
    expect(reverted[1]?.career.losses).toBe(1);
  });
});

describe('applyCompletedMatchCorrection', () => {
  const players = [
    createPlayer({ id: 'p1', name: 'Alice', gender: 'female' }),
    createPlayer({ id: 'p2', name: 'Bob', gender: 'male' }),
    createPlayer({ id: 'p3', name: 'Cara', gender: 'female' }),
    createPlayer({ id: 'p4', name: 'Dan', gender: 'male' }),
  ].map((player, index) => ({
    ...player,
    gamesPlayed: 1,
    wins: index === 0 || index === 1 ? 1 : 0,
    losses: index === 0 || index === 1 ? 0 : 1,
    career: {
      gamesPlayed: 1,
      wins: index === 0 || index === 1 ? 1 : 0,
      losses: index === 0 || index === 1 ? 0 : 1,
    },
  }));

  const completedMatch: Match = {
    id: 'm1',
    courtId: 'c1',
    playerIds: ['p1', 'p2', 'p3', 'p4'],
    format: 'doubles',
    status: 'completed',
    winnerPlayerIds: ['p1', 'p2'],
    completedAt: 1000,
  };

  const queueState: QueueState = {
    queue: [],
    activeMatches: [],
    completedMatches: [completedMatch],
  };

  it('corrects the winner and updates stats', () => {
    const result = applyCompletedMatchCorrection(queueState, players, 'm1', {
      playerIds: ['p1', 'p2', 'p3', 'p4'],
      winningTeam: 'B',
      correctionNote: 'Correct winner was Team 2',
    });

    expect(result).not.toBeNull();
    expect(result?.queueState.completedMatches[0]?.winnerPlayerIds).toEqual(['p3', 'p4']);
    expect(result?.queueState.completedMatches[0]?.correctionNote).toBe('Correct winner was Team 2');
    expect(result?.players.find((p) => p.id === 'p1')?.wins).toBe(0);
    expect(result?.players.find((p) => p.id === 'p3')?.wins).toBe(1);
  });

  it('stores a note without changing stats when only the note changes', () => {
    const result = applyCompletedMatchCorrection(queueState, players, 'm1', {
      playerIds: ['p1', 'p2', 'p3', 'p4'],
      winningTeam: 'A',
      correctionNote: 'Verified on video',
    });

    expect(result?.queueState.completedMatches[0]?.correctionNote).toBe('Verified on video');
    expect(result?.players.find((p) => p.id === 'p1')?.wins).toBe(1);
  });

  it('moves win/loss stats when a winning player is replaced on the completed match', () => {
    const roster = [
      ...players,
      {
        ...createPlayer({ id: 'p5', name: 'Eve', gender: 'female' }),
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        career: { gamesPlayed: 0, wins: 0, losses: 0 },
      },
    ];

    const result = applyCompletedMatchCorrection(queueState, roster, 'm1', {
      playerIds: ['p1', 'p2', 'p5', 'p4'],
      winningTeam: 'B',
    });

    expect(result?.queueState.completedMatches[0]?.playerIds).toEqual(['p1', 'p2', 'p5', 'p4']);
    expect(result?.queueState.completedMatches[0]?.winnerPlayerIds).toEqual(['p5', 'p4']);
    expect(result?.players.find((p) => p.id === 'p3')?.gamesPlayed).toBe(0);
    expect(result?.players.find((p) => p.id === 'p3')?.wins).toBe(0);
    expect(result?.players.find((p) => p.id === 'p5')?.gamesPlayed).toBe(1);
    expect(result?.players.find((p) => p.id === 'p5')?.wins).toBe(1);
    expect(result?.players.find((p) => p.id === 'p5')?.career.wins).toBe(1);
  });
});
