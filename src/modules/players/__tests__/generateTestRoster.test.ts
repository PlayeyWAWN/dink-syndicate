import {
  generateTestRoster,
  mergeTestRoster,
  TEST_ROSTER_SIZE,
} from '@/modules/players/generateTestRoster';
import { createPlayer } from '@/types/player';

describe('generateTestRoster', () => {
  it('creates 125 players with varied DUPR and alternating gender', () => {
    const roster = generateTestRoster();
    expect(roster).toHaveLength(TEST_ROSTER_SIZE);
    expect(roster[0].name).toBe('Test Player 001');
    expect(roster[124].name).toBe('Test Player 125');
    expect(roster[0].gender).toBe('male');
    expect(roster[1].gender).toBe('female');
    expect(roster.every((player) => player.checkedIn)).toBe(true);

    const ratings = roster.map((player) => player.dupr.duprDoublesRating ?? 0);
    expect(Math.min(...ratings)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...ratings)).toBeGreaterThanOrEqual(5);
    expect(new Set(ratings).size).toBeGreaterThan(20);
  });

  it('skips names that already exist when merging', () => {
    const existing = [createPlayer({ id: 'a', name: 'Test Player 001' })];
    const generated = generateTestRoster({ count: 3 });
    const result = mergeTestRoster(existing, generated);
    expect(result.added).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.players).toHaveLength(3);
  });
});
