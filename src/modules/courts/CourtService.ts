import { DEFAULT_COURT_COUNT } from '@/config/constants';
import { Court, createCourt, defaultCourtLabel } from '@/types/court';

const MAX_COURTS = 24;

/** Court slot configuration and roster management. */
export class CourtService {
  ensureCourts(courts: Court[], count = DEFAULT_COURT_COUNT): Court[] {
    if (courts.length >= count) return courts.slice(0, count);
    const next = [...courts];
    for (let i = courts.length; i < count; i += 1) {
      next.push(createCourt(i));
    }
    return next;
  }

  nextCourtId(courts: Court[]): string {
    let n = courts.length + 1;
    while (courts.some((c) => c.id === `court-${n}`)) n += 1;
    return `court-${n}`;
  }

  defaultLabelForNewCourt(courts: Court[]): string {
    const used = new Set(courts.map((c) => c.label));
    let n = courts.length + 1;
    while (used.has(String(n))) n += 1;
    return String(n);
  }

  addCourt(courts: Court[], label?: string): Court[] {
    if (courts.length >= MAX_COURTS) return courts;
    const index = courts.length;
    const id = this.nextCourtId(courts);
    const resolvedLabel = label?.trim() || this.defaultLabelForNewCourt(courts);
    const court = createCourt(index, resolvedLabel);
    return [...courts, { ...court, id }];
  }

  renameCourt(courts: Court[], courtId: string, label: string): Court[] {
    const trimmed = label.trim();
    if (!trimmed) return courts;
    return courts.map((c) => (c.id === courtId ? { ...c, label: trimmed } : c));
  }

  assignMatch(courts: Court[], courtId: string, matchId: string | null): Court[] {
    return courts.map((c) => (c.id === courtId ? { ...c, activeMatchId: matchId } : c));
  }

  clearCourt(courts: Court[], courtId: string): Court[] {
    return this.assignMatch(courts, courtId, null);
  }

  removeCourt(courts: Court[], courtId: string): Court[] {
    if (!courts.some((c) => c.id === courtId)) return courts;
    return courts.filter((c) => c.id !== courtId);
  }
}

export const courtService = new CourtService();
export { defaultCourtLabel, MAX_COURTS };
