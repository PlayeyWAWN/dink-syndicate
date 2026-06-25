import { buildSessionArchive, hasSessionActivity } from '@/modules/session/session-archive-utils';
import { APP_DATA_VERSION, AppData, migrateAppData } from '@/types/app-data';
import { createPlayer } from '@/types/player';
import { SessionSchema } from '@/types/session';

const baseData: AppData = migrateAppData({
  version: APP_DATA_VERSION,
  session: SessionSchema.parse({
    id: 'test-session',
    organizerName: 'Host',
    role: 'queue_master',
    createdAt: Date.now(),
  }),
  players: [createPlayer({ id: 'p1', name: 'Alice' })],
  courts: [],
  queueState: { queue: [], activeMatches: [], completedMatches: [] },
  settings: { courtCount: 4, organizerName: 'Host', sessionStartTime: 1000 },
  sessionArchives: [],
});

describe('session-archive-utils', () => {
  it('detects session activity from player games', () => {
    const data: AppData = {
      ...baseData,
      players: [{ ...createPlayer({ id: 'p1', name: 'Alice' }), gamesPlayed: 2, wins: 1, losses: 1 }],
    };
    expect(hasSessionActivity(data)).toBe(true);
  });

  it('builds archive with per-player session stats', () => {
    const data: AppData = {
      ...baseData,
      players: [{ ...createPlayer({ id: 'p1', name: 'Alice' }), gamesPlayed: 2, wins: 2, losses: 0 }],
      queueState: {
        ...baseData.queueState,
        completedMatches: [
          {
            id: 'm1',
            courtId: 'court-1',
            playerIds: ['p1', 'p2'],
            format: 'singles' as const,
            status: 'completed' as const,
            winnerPlayerIds: ['p1'],
            completedAt: 4000,
          },
        ],
      },
    };

    const archive = buildSessionArchive(data, 'Tuesday Open Play', 5000);
    expect(archive.name).toBe('Tuesday Open Play');
    expect(archive.startedAt).toBe(1000);
    expect(archive.endedAt).toBe(5000);
    expect(archive.matchesCompleted).toBe(1);
    expect(archive.playerStats).toEqual([
      {
        playerId: 'p1',
        playerName: 'Alice',
        gamesPlayed: 2,
        wins: 2,
        losses: 0,
      },
    ]);
  });
});
