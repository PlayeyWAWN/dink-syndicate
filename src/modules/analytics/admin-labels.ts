/** Plain-English labels for Admin dashboard route column. */
export function adminRouteLabel(route: string | undefined): string {
  switch (route) {
    case 'home':
      return 'On home';
    case 'queue':
      return 'Managing queue';
    case 'players':
      return 'Managing players';
    case 'courts':
      return 'Managing courts';
    case 'stats':
      return 'Viewing stats';
    case 'settings':
      return 'In settings';
    case 'admin':
      return 'In admin';
    default:
      return 'Using the app';
  }
}

export function gameModeLabel(mode: string | undefined): string {
  switch (mode) {
    case 'dupr_open_play':
      return 'DUPR Open Play';
    case 'win_lose_stack':
      return 'Win/Lose Stack';
    case 'ladder_waterfall':
      return 'Ladder / Waterfall';
    default:
      return mode ?? '—';
  }
}

export function formatDurationMs(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
