/** Queue → Create Match court format + matching mode (Smash Syndicate parity). */

export type CourtFormat = 'doubles' | 'singles';

export type QueueMatchMode = 'balanced' | 'mixed_doubles' | 'same_gender';

export const COURT_FORMATS: { id: CourtFormat; label: string }[] = [
  { id: 'doubles', label: 'Doubles' },
  { id: 'singles', label: 'Singles' },
];

export const QUEUE_MATCH_MODES: { id: QueueMatchMode; label: string; shortLabel: string }[] = [
  { id: 'balanced', label: 'Balanced Skill', shortLabel: 'Balanced' },
  { id: 'mixed_doubles', label: 'Mix 1M+1F', shortLabel: 'Mix' },
  { id: 'same_gender', label: 'Same Gender Balanced', shortLabel: 'Same Gender' },
];

export const CREATE_MATCH_ERROR = {
  singlesInsufficient: 'Need at least 2 available players for a skill-balanced singles match.',
  singlesNoBalance:
    'No skill-balanced singles pair found. Try checking in players with closer DUPR ratings.',
  balancedInsufficient: 'Need at least 4 available players for balanced doubles.',
  balancedNoMatch:
    'No balanced doubles match found with the current skill spread. Try Mix or Same Gender mode, adjust who is available, or turn off Synergy Team if locked pairs block a valid lineup.',
  mixedInsufficient:
    'Need at least 2 available males and 2 available females for mixed doubles.',
  mixedNoMatch:
    'No balanced mixed doubles match found with the current skill spread. Adjust who is available, try Balanced mode, or turn off Synergy Team if locked pairs block a valid lineup.',
  sameGenderInsufficient:
    'Need at least 4 available males or 4 available females for a skill-balanced same-gender match.',
  sameGenderNoMatch:
    'No balanced same-gender match found with the current skill spread. Adjust who is available.',
} as const;

export interface CreateMatchErrorCounts {
  available: number;
  males?: number;
  females?: number;
}

export function createMatchErrorMessage(
  courtFormat: CourtFormat,
  matchMode: QueueMatchMode,
  counts: CreateMatchErrorCounts
): string {
  const { available, males = 0, females = 0 } = counts;

  if (courtFormat === 'singles') {
    if (available < 2) return CREATE_MATCH_ERROR.singlesInsufficient;
    return CREATE_MATCH_ERROR.singlesNoBalance;
  }

  if (matchMode === 'balanced') {
    if (available < 4) return CREATE_MATCH_ERROR.balancedInsufficient;
    return CREATE_MATCH_ERROR.balancedNoMatch;
  }

  if (matchMode === 'mixed_doubles') {
    if (males < 2 || females < 2) return CREATE_MATCH_ERROR.mixedInsufficient;
    return CREATE_MATCH_ERROR.mixedNoMatch;
  }

  if (males < 4 && females < 4) return CREATE_MATCH_ERROR.sameGenderInsufficient;
  return CREATE_MATCH_ERROR.sameGenderNoMatch;
}

/** Shown when the user taps Play but every court has an active match. */
export function allCourtsOccupiedMessage(courtCount: number, activeMatchCount: number): string {
  const courtLabel = courtCount === 1 ? 'court is' : 'courts are';
  return (
    `All ${courtCount} ${courtLabel} currently occupied.\n\n` +
    `Active matches: ${activeMatchCount}/${courtCount}\n\n` +
    `To start this queued match:\n` +
    `• Finish a match on court and record the winner, or\n` +
    `• Add more courts from the Courts tab.`
  );
}
