import { QueueService } from '@/modules/queue/QueueService';
import { createPlayer } from '@/types/player';

describe('QueueService', () => {
  const service = new QueueService();

  it('excludes queued and active players from available pool', () => {
    const players = Array.from({ length: 5 }, (_, i) =>
      createPlayer({ id: `p${i}`, name: `P${i}`, checkedIn: true })
    );
    const state = {
      queue: [
        {
          id: 'q1',
          playerIds: ['p0', 'p1', 'p2', 'p3'],
          format: 'doubles' as const,
          createdAt: Date.now(),
        },
      ],
      activeMatches: [],
      completedMatches: [],
    };
    const available = service.getAvailablePlayers(players, state);
    expect(available).toHaveLength(1);
    expect(available[0].id).toBe('p4');
  });

  it('excludes excluded players from available pool', () => {
    const players = [
      createPlayer({ id: 'p0', name: 'A', checkedIn: true }),
      { ...createPlayer({ id: 'p1', name: 'B' }), excluded: true },
    ];
    const available = service.getAvailablePlayers(players, {
      queue: [],
      activeMatches: [],
      completedMatches: [],
    });
    expect(available).toHaveLength(1);
    expect(available[0].id).toBe('p0');
  });

  it('excludes unchecked-in players from available pool', () => {
    const players = [
      createPlayer({ id: 'p0', name: 'A', checkedIn: true }),
      { ...createPlayer({ id: 'p1', name: 'B' }), checkedIn: false },
    ];
    const available = service.getAvailablePlayers(players, {
      queue: [],
      activeMatches: [],
      completedMatches: [],
    });
    expect(available).toHaveLength(1);
    expect(available[0].id).toBe('p0');
  });

  it('excludes paused players from available pool', () => {
    const players = [
      createPlayer({ id: 'p0', name: 'A', checkedIn: true }),
      {
        ...createPlayer({ id: 'p1', name: 'B', checkedIn: true }),
        pausedUntil: Date.now() + 60_000,
      },
    ];
    const available = service.getAvailablePlayers(players, {
      queue: [],
      activeMatches: [],
      completedMatches: [],
    });
    expect(available).toHaveLength(1);
    expect(available[0].id).toBe('p0');
  });

  it('lists standby excluded players who are not busy', () => {
    const now = 1_000_000;
    const players = [
      createPlayer({ id: 'p0', name: 'A', checkedIn: true }),
      { ...createPlayer({ id: 'p1', name: 'B' }), checkedIn: false },
      {
        ...createPlayer({ id: 'p2', name: 'C', checkedIn: true }),
        pausedUntil: now + 60_000,
      },
      { ...createPlayer({ id: 'p3', name: 'D', checkedIn: true }), excluded: true },
    ];
    const state = {
      queue: [
        {
          id: 'q1',
          playerIds: ['p0', 'p4', 'p5', 'p6'],
          format: 'doubles' as const,
          createdAt: now,
        },
      ],
      activeMatches: [],
      completedMatches: [],
    };
    const excluded = service.getStandbyExcludedPlayers(players, state, now);
    expect(excluded.map((player) => player.id).sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('never lists queued or active players in standby excluded', () => {
    const players = Array.from({ length: 4 }, (_, i) =>
      createPlayer({ id: `p${i}`, name: `P${i}`, checkedIn: false })
    );
    const state = {
      queue: [
        {
          id: 'q1',
          playerIds: ['p0', 'p1', 'p2', 'p3'],
          format: 'doubles' as const,
          createdAt: Date.now(),
        },
      ],
      activeMatches: [],
      completedMatches: [],
    };
    expect(service.getStandbyExcludedPlayers(players, state)).toHaveLength(0);
  });

  it('returns active match to the front of the queue', () => {
    const entry = {
      id: 'q1',
      playerIds: ['p0', 'p1', 'p2', 'p3'],
      format: 'doubles' as const,
      createdAt: 1000,
      availableSinceByPlayer: { p0: 500, p1: 500, p2: 500, p3: 500 },
    };
    const state = {
      queue: [{ ...entry, id: 'q2', createdAt: 2000 }],
      activeMatches: [
        {
          id: 'm1',
          courtId: 'court-1',
          playerIds: entry.playerIds,
          format: 'doubles' as const,
          status: 'active' as const,
          winnerPlayerIds: [],
          queuedAt: entry.createdAt,
          availableSinceByPlayer: entry.availableSinceByPlayer,
          startedAt: 3000,
        },
      ],
      completedMatches: [],
    };

    const next = service.returnActiveMatchToQueue(state, 'm1');
    expect(next).not.toBeNull();
    expect(next!.activeMatches).toHaveLength(0);
    expect(next!.queue).toHaveLength(2);
    expect(next!.queue[0]?.playerIds).toEqual(entry.playerIds);
    expect(next!.queue[0]?.availableSinceByPlayer).toEqual(entry.availableSinceByPlayer);
    expect(next!.queue[0]?.createdAt).toBe(entry.createdAt);
  });

  it('preserves manual source when returning active match to queue', () => {
    const state = {
      queue: [],
      activeMatches: [
        {
          id: 'm1',
          courtId: 'court-1',
          playerIds: ['p0', 'p1', 'p2', 'p3'],
          format: 'doubles' as const,
          status: 'active' as const,
          winnerPlayerIds: [],
          source: 'manual' as const,
          startedAt: 3000,
        },
      ],
      completedMatches: [],
    };

    const next = service.returnActiveMatchToQueue(state, 'm1');
    expect(next!.queue[0]?.source).toBe('manual');
  });
});
