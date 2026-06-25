import { createPlayer, Player, PlayerGender } from '@/types/player';

export const TEST_ROSTER_SIZE = 125;

/** Skill-tier buckets — totals sum to TEST_ROSTER_SIZE. */
const TEST_ROSTER_TIERS = [
  { count: 28, base: 2.0, step: 0.12 },
  { count: 32, base: 3.0, step: 0.1 },
  { count: 35, base: 4.0, step: 0.1 },
  { count: 30, base: 5.0, step: 0.08 },
] as const;

export interface GenerateTestRosterOptions {
  count?: number;
  /** Prefix for generated names — default "Test Player". */
  namePrefix?: string;
  /** When true, all dummy players start checked in and available. */
  checkIn?: boolean;
}

function ratingsForCount(count: number): number[] {
  const ratings: number[] = [];
  for (const tier of TEST_ROSTER_TIERS) {
    for (let i = 0; i < tier.count && ratings.length < count; i += 1) {
      const rating = Math.min(8, Math.round((tier.base + i * tier.step) * 100) / 100);
      ratings.push(rating);
    }
  }
  while (ratings.length < count) {
    ratings.push(3.5);
  }
  return ratings.slice(0, count);
}

function genderForIndex(index: number): PlayerGender {
  return index % 2 === 0 ? 'male' : 'female';
}

function testPlayerName(prefix: string, index: number): string {
  return `${prefix} ${String(index + 1).padStart(3, '0')}`;
}

/** Build dummy players with spread DUPR ratings and alternating gender. */
export function generateTestRoster(options: GenerateTestRosterOptions = {}): Player[] {
  const count = options.count ?? TEST_ROSTER_SIZE;
  const prefix = options.namePrefix ?? 'Test Player';
  const checkIn = options.checkIn ?? true;
  const ratings = ratingsForCount(count);

  return ratings.map((duprDoublesRating, index) =>
    createPlayer({
      id: `test-roster-${index + 1}`,
      name: testPlayerName(prefix, index),
      gender: genderForIndex(index),
      duprDoublesRating,
      checkedIn: checkIn,
    })
  );
}

export interface MergeTestRosterResult {
  players: Player[];
  added: number;
  skipped: number;
}

/** Append generated players, skipping name collisions with the existing roster. */
export function mergeTestRoster(existing: Player[], generated: Player[]): MergeTestRosterResult {
  const existingNames = new Set(existing.map((player) => player.name.toLowerCase()));
  const toAdd: Player[] = [];
  let skipped = 0;

  for (const player of generated) {
    if (existingNames.has(player.name.toLowerCase())) {
      skipped += 1;
      continue;
    }
    existingNames.add(player.name.toLowerCase());
    toAdd.push(player);
  }

  return {
    players: [...existing, ...toAdd],
    added: toAdd.length,
    skipped,
  };
}
