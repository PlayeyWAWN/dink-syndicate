import { PlayerService } from '@/modules/players/PlayerService';
import { createPlayer } from '@/types/player';

describe('PlayerService', () => {
  const service = new PlayerService();

  it('adds unique players with gender', () => {
    const next = service.addPlayer([], 'Alex', 3.5, 'female');
    expect(next).toHaveLength(1);
    expect(next[0].name).toBe('Alex');
    expect(next[0].gender).toBe('female');
  });

  it('defaults new players to not checked in', () => {
    const next = service.addPlayer([], 'Alex');
    expect(next[0].checkedIn).toBe(false);
    expect(next[0].checkedInAt).toBeUndefined();
    expect(next[0].availableSince).toBeUndefined();
  });

  it('defaults gender to male', () => {
    const next = service.addPlayer([], 'Alex');
    expect(next[0].gender).toBe('male');
  });

  it('rejects duplicate names', () => {
    const players = [createPlayer({ id: '1', name: 'Alex' })];
    expect(() => service.addPlayer(players, 'alex')).toThrow(/already exists/);
  });

  it('bulk adds players and skips duplicates', () => {
    const players = [createPlayer({ id: '1', name: 'Alex' })];
    const result = service.bulkAddPlayers(players, ['Alex', 'Ben', 'Cara'], 3.5, 'male');
    expect(result.added).toBe(2);
    expect(result.skipped).toEqual(['Alex']);
    expect(result.players).toHaveLength(3);
    expect(result.players[1].checkedIn).toBe(false);
  });

  it('toggles check-in state and stamps checkedInAt', () => {
    const players = [createPlayer({ id: '1', name: 'Alex' })];
    const checkedIn = service.toggleCheckIn(players, '1');
    expect(checkedIn[0].checkedIn).toBe(true);
    expect(checkedIn[0].checkedInAt).toBeDefined();
    expect(checkedIn[0].availableSince).toBeDefined();

    const checkedOut = service.toggleCheckIn(checkedIn, '1');
    expect(checkedOut[0].checkedIn).toBe(false);
    expect(checkedOut[0].checkedInAt).toBeUndefined();
    expect(checkedOut[0].availableSince).toBeUndefined();
  });

  it('excludes and includes players', () => {
    const players = [createPlayer({ id: '1', name: 'Alex', checkedIn: true })];
    const excluded = service.setExcluded(players, '1', true);
    expect(excluded[0].excluded).toBe(true);
    expect(excluded[0].checkedIn).toBe(false);

    const included = service.includeAllPlayers(excluded);
    expect(included[0].excluded).toBe(false);
  });

  it('pauses a player and clears availability', () => {
    const now = 1_000_000;
    const players = [
      {
        ...createPlayer({ id: '1', name: 'Alex', checkedIn: true }),
        availableSince: now - 60_000,
      },
    ];
    const paused = service.pausePlayer(players, '1', 15 * 60 * 1000, now);
    expect(paused[0].pausedUntil).toBe(now + 15 * 60 * 1000);
    expect(paused[0].availableSince).toBeUndefined();
  });

  it('returns a player from break and restores availability', () => {
    const now = 2_000_000;
    const players = [
      {
        ...createPlayer({ id: '1', name: 'Alex', checkedIn: true }),
        pausedUntil: now + 60_000,
      },
    ];
    const returned = service.returnFromBreak(players, '1', now);
    expect(returned[0].pausedUntil).toBeUndefined();
    expect(returned[0].availableSince).toBe(now);
  });

  it('clears expired pauses automatically', () => {
    const now = 3_000_000;
    const players = [
      {
        ...createPlayer({ id: '1', name: 'Alex', checkedIn: true }),
        pausedUntil: now - 1,
      },
      {
        ...createPlayer({ id: '2', name: 'Ben', checkedIn: true }),
        pausedUntil: now + 60_000,
      },
    ];
    const next = service.clearExpiredPauses(players, now);
    expect(next[0].pausedUntil).toBeUndefined();
    expect(next[0].availableSince).toBe(now);
    expect(next[1].pausedUntil).toBe(now + 60_000);
  });

  it('updates manual dupr rating', () => {
    const players = [createPlayer({ id: '1', name: 'Alex' })];
    const next = service.updateDuprRating(players, '1', 4.25);
    expect(next[0].dupr.duprDoublesRating).toBe(4.25);
    expect(next[0].dupr.duprRatingSource).toBe('manual');
  });

  it('sorts and filters players', () => {
    const players = [
      createPlayer({ id: '1', name: 'Zara', duprDoublesRating: 4 }),
      createPlayer({ id: '2', name: 'Alex', duprDoublesRating: 3 }),
    ];
    players[0].excluded = true;

    const filtered = service.filterPlayers(players, { status: 'excluded' });
    expect(filtered).toHaveLength(1);

    const sorted = service.sortPlayers(players, 'name');
    expect(sorted[0].name).toBe('Alex');
  });
});
