import { APP_DATA_VERSION, migrateAppData } from '@/types/app-data';
import { SessionSchema } from '@/types/session';

describe('migrateAppData', () => {
  it('migrates v1 players into career stats without losing session counters', () => {
    const raw = {
      version: 1,
      session: SessionSchema.parse({
        id: 'test-session',
        organizerName: 'Host',
        role: 'queue_master',
        createdAt: Date.now(),
      }),
      players: [
        {
          id: 'p1',
          name: 'Alice',
          gender: 'female',
          excluded: false,
          checkedIn: true,
          gamesPlayed: 4,
          wins: 3,
          losses: 1,
          dupr: { duprConnected: false, duprRatingSource: 'manual', duprDoublesRating: 3.5 },
          createdAt: 1,
          updatedAt: 2,
        },
      ],
      courts: [],
      queueState: { queue: [], activeMatches: [], completedMatches: [] },
    };

    const migrated = migrateAppData(raw);
    expect(migrated.version).toBe(APP_DATA_VERSION);
    expect(migrated.sessionArchives).toEqual([]);
    expect(migrated.players[0]?.gamesPlayed).toBe(4);
    expect(migrated.players[0]?.career).toEqual({
      gamesPlayed: 4,
      wins: 3,
      losses: 1,
    });
  });

  it('leaves v2 snapshots unchanged aside from validation defaults', () => {
    const raw = {
      version: 2,
      session: SessionSchema.parse({
        id: 'test-session',
        organizerName: 'Host',
        role: 'queue_master',
        createdAt: Date.now(),
      }),
      players: [],
      courts: [],
      queueState: { queue: [], activeMatches: [], completedMatches: [] },
      sessionArchives: [
        {
          id: 'archive-1',
          name: 'Jun 24 Open Play',
          startedAt: 1,
          endedAt: 2,
          matchesCompleted: 3,
          playerStats: [],
        },
      ],
    };

    const migrated = migrateAppData(raw);
    expect(migrated.version).toBe(APP_DATA_VERSION);
    expect(migrated.sessionArchives).toHaveLength(1);
    expect(migrated.sessionArchives[0]?.name).toBe('Jun 24 Open Play');
    expect(migrated.settings?.gameMode).toBe('dupr_open_play');
  });

  it('migrates v2 snapshots to v3 with default game mode', () => {
    const raw = {
      version: 2,
      session: SessionSchema.parse({
        id: 'test-session',
        organizerName: 'Host',
        role: 'queue_master',
        createdAt: Date.now(),
      }),
      players: [],
      courts: [],
      queueState: { queue: [], activeMatches: [], completedMatches: [] },
    };

    const migrated = migrateAppData(raw);
    expect(migrated.version).toBe(3);
    expect(migrated.settings?.gameMode).toBe('dupr_open_play');
  });
});
