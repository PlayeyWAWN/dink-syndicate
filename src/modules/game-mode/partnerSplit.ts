import { splitTeams } from '@/lib/format-utils';

function wereLastPartners(
  id1: string,
  id2: string,
  lastPartnerByPlayer: Record<string, string>
): boolean {
  return lastPartnerByPlayer[id1] === id2 || lastPartnerByPlayer[id2] === id1;
}

export interface PartnerSplitResult {
  playerIds: string[];
  hadPartnerConflict: boolean;
}

/** Arrange four doubles players so prior teammates are on opposite teams when possible. */
export function partnerSplitPairing(
  playerIds: string[],
  lastPartnerByPlayer: Record<string, string>
): PartnerSplitResult {
  if (playerIds.length !== 4) {
    return { playerIds: [...playerIds], hadPartnerConflict: false };
  }

  const [p0, p1, p2, p3] = playerIds;
  const pairings: [string, string, string, string][] = [
    [p0, p1, p2, p3],
    [p0, p2, p1, p3],
    [p0, p3, p1, p2],
  ];

  for (const pairing of pairings) {
    const [a1, a2, b1, b2] = pairing;
    const teamAConflict = wereLastPartners(a1, a2, lastPartnerByPlayer);
    const teamBConflict = wereLastPartners(b1, b2, lastPartnerByPlayer);
    if (!teamAConflict && !teamBConflict) {
      return { playerIds: pairing, hadPartnerConflict: false };
    }
  }

  return { playerIds: [p0, p1, p2, p3], hadPartnerConflict: true };
}

/** Record each player's partner from the active lineup. */
export function updateLastPartners(
  playerIds: string[],
  lastPartnerByPlayer: Record<string, string>
): Record<string, string> {
  const next = { ...lastPartnerByPlayer };
  const { teamA, teamB } = splitTeams(playerIds);

  if (teamA.length === 2) {
    next[teamA[0]] = teamA[1];
    next[teamA[1]] = teamA[0];
  }
  if (teamB.length === 2) {
    next[teamB[0]] = teamB[1];
    next[teamB[1]] = teamB[0];
  }

  return next;
}

/** Remove partner links for players returned to the stack after a cancelled match. */
export function clearLastPartnersForPlayers(
  playerIds: string[],
  lastPartnerByPlayer: Record<string, string>
): Record<string, string> {
  const next = { ...lastPartnerByPlayer };
  for (const id of playerIds) {
    const partnerId = next[id];
    delete next[id];
    if (partnerId) {
      delete next[partnerId];
    }
  }
  return next;
}
