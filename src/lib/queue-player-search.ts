import { Player } from '@/types/player';

/** Case-insensitive name filter for queue player panels. */
export function filterPlayersBySearch(players: Player[], query: string): Player[] {
  const term = query.trim().toLowerCase();
  if (!term) return players;
  return players.filter((player) => player.name.toLowerCase().includes(term));
}
