import { Player } from '@/types/player';

export function duprDoublesRating(player: Player): number {
  return player.dupr.duprDoublesRating ?? 0;
}

export function duprSinglesRating(player: Player): number {
  return player.dupr.duprSinglesRating ?? player.dupr.duprDoublesRating ?? 0;
}
