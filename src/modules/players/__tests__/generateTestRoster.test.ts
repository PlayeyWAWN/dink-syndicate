import {
  generateTestRoster,
  mergeTestRoster,
  TEST_ROSTER_SIZE,
} from '@/modules/players/generateTestRoster';
import { createPlayer } from '@/types/player';

describe('generateTestRoster', () => {
  it('creates 50 players with realistic names, varied DUPR, and balanced gender', () => {
    const roster = generateTestRoster();
    expect(roster).toHaveLength(TEST_ROSTER_SIZE);
    expect(roster[0].name).toBe('Marcus Chen');
    expect(roster[1].name).toBe('Sarah Mitchell');
    expect(roster[49].name).toBe('Chloe Hughes');
    expect(roster[0].gender).toBe('male');
    expect(roster[1].gender).toBe('female');
    expect(roster.every((player) => player.checkedIn)).toBe(true);

    const names = roster.map((player) => player.name);
    expect(new Set(names).size).toBe(TEST_ROSTER_SIZE);

    const maleCount = roster.filter((player) => player.gender === 'male').length;
    const femaleCount = roster.filter((player) => player.gender === 'female').length;
    expect(maleCount).toBe(25);
    expect(femaleCount).toBe(25);

    const ratings = roster.map((player) => player.dupr.duprDoublesRating ?? 0);
    expect(Math.min(...ratings)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...ratings)).toBeGreaterThanOrEqual(5);
    expect(new Set(ratings).size).toBeGreaterThan(10);
  });

  it('skips names that already exist when merging', () => {
    const existing = [createPlayer({ id: 'a', name: 'Marcus Chen' })];
    const generated = generateTestRoster({ count: 3 });
    const result = mergeTestRoster(existing, generated);
    expect(result.added).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.players).toHaveLength(3);
  });
});
