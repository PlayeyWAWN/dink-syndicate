import { createPlayer, Player, PlayerGender } from '@/types/player';

export const TEST_ROSTER_SIZE = 50;

export const TEST_ROSTER_COUNT_OPTIONS = [8, 16, 24, 32, 50] as const;

export type TestRosterCountOption = (typeof TEST_ROSTER_COUNT_OPTIONS)[number];

/** Skill-tier buckets — totals sum to TEST_ROSTER_SIZE. */
const TEST_ROSTER_TIERS = [
  { count: 11, base: 2.0, step: 0.12 },
  { count: 13, base: 3.0, step: 0.1 },
  { count: 14, base: 4.0, step: 0.1 },
  { count: 12, base: 5.0, step: 0.08 },
] as const;

const MALE_NAMES = [
  'Marcus Chen',
  'James Rivera',
  'David Okonkwo',
  'Michael Torres',
  'Ryan Patel',
  'Daniel Kim',
  'Chris Nguyen',
  'Andrew Brooks',
  'Kevin Walsh',
  'Brian Foster',
  'Jason Lewis',
  'Eric Thompson',
  'Adam Garcia',
  'Nathan Reed',
  'Tyler Morgan',
  'Brandon Scott',
  'Justin Hayes',
  'Aaron Price',
  'Derek Coleman',
  'Gregory Bennett',
  'Patrick Sullivan',
  'Timothy Ross',
  'Steven Butler',
  'Kenneth Powell',
  'Benjamin Hughes',
] as const;

const FEMALE_NAMES = [
  'Sarah Mitchell',
  'Emily Nguyen',
  'Jessica Brooks',
  'Ashley Patel',
  'Amanda Torres',
  'Nicole Kim',
  'Stephanie Chen',
  'Rachel Rivera',
  'Lauren Walsh',
  'Megan Foster',
  'Hannah Lewis',
  'Olivia Thompson',
  'Sophia Garcia',
  'Emma Reed',
  'Ava Morgan',
  'Isabella Scott',
  'Mia Hayes',
  'Charlotte Price',
  'Amelia Coleman',
  'Harper Bennett',
  'Evelyn Sullivan',
  'Abigail Ross',
  'Ella Butler',
  'Grace Powell',
  'Chloe Hughes',
] as const;

export interface GenerateTestRosterOptions {
  count?: number;
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

function testPlayerName(index: number): string {
  const gender = genderForIndex(index);
  const slot = Math.floor(index / 2);
  return gender === 'male' ? MALE_NAMES[slot] : FEMALE_NAMES[slot];
}

/** Build dummy players with spread DUPR ratings, realistic names, and balanced gender. */
export function generateTestRoster(options: GenerateTestRosterOptions = {}): Player[] {
  const count = options.count ?? TEST_ROSTER_SIZE;
  const checkIn = options.checkIn ?? true;
  const ratings = ratingsForCount(count);

  return ratings.map((duprDoublesRating, index) =>
    createPlayer({
      id: `test-roster-${index + 1}`,
      name: testPlayerName(index),
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
