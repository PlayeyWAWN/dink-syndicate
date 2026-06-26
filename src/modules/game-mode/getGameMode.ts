import { AppSettings } from '@/types/app-data';
import { DEFAULT_GAME_MODE, GameMode } from '@/types/game-mode';

export function getGameMode(settings: AppSettings | undefined): GameMode {
  return settings?.gameMode ?? DEFAULT_GAME_MODE;
}

export function hasActiveMatches(activeMatchCount: number): boolean {
  return activeMatchCount > 0;
}
