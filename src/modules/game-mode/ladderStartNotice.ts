/** Human-readable copy when a ladder bench auto-starts a match. */

export function formatPlayerNameList(names: string[]): string {
  const trimmed = names.map((name) => name.trim()).filter(Boolean);
  if (trimmed.length === 0) return 'Players';
  if (trimmed.length === 1) return trimmed[0];
  if (trimmed.length === 2) return `${trimmed[0]} & ${trimmed[1]}`;
  return `${trimmed.slice(0, -1).join(', ')} & ${trimmed[trimmed.length - 1]}`;
}

export function formatLadderStartNotice(courtLabel: string, playerNames: string[]): string {
  return `${formatPlayerNameList(playerNames)} moved to ${courtLabel} — game started`;
}
