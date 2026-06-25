/** Session-level game rotation modes. */
export type GameMode = 'dupr_open_play' | 'win_lose_stack';

export interface GameModeOption {
  id: GameMode;
  label: string;
  shortDescription: string;
}

export const GAME_MODE_OPTIONS: GameModeOption[] = [
  {
    id: 'dupr_open_play',
    label: 'DUPR Open Play',
    shortDescription: 'Skill-balanced Find Match with manual lineup options.',
  },
  {
    id: 'win_lose_stack',
    label: 'Win/Lose Stack',
    shortDescription:
      'Double-queue rotation: winners and losers wait in separate stacks; Next-Up alternates between stacks with partner shuffle.',
  },
];

export const DEFAULT_GAME_MODE: GameMode = 'dupr_open_play';

export function isWinLoseStackMode(mode: GameMode | undefined): boolean {
  return mode === 'win_lose_stack';
}
