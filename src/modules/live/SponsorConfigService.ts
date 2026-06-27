import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { stripUndefinedDeep } from '@/lib/firestore-sanitize';
import { getFirebaseFirestore } from '@/config/firebase-app';
import { isFirebaseEnabled } from '@/config/firebase';
import { FIRESTORE_PATHS } from '@/modules/live/firestore-paths';
import { SponsorConfig, SponsorConfigSchema, SponsorEntry } from '@/types/live';

const DEFAULT_CONFIG: SponsorConfig = {
  sponsorsEnabled: false,
  sponsors: [],
  updatedAt: Date.now(),
};

export const MAX_SPONSOR_SLOTS = 18;
export const SPONSORS_PER_ROW = 6;
const MAX_SLOT_INDEX = MAX_SPONSOR_SLOTS - 1;

/** Lowest unused wallboard grid slot (0–17), or 18 when full. */
export function findFirstFreeSlot(used: Set<number>): number {
  for (let slot = 0; slot <= MAX_SLOT_INDEX; slot++) {
    if (!used.has(slot)) return slot;
  }
  return MAX_SPONSOR_SLOTS;
}

/** Human-readable slot label, e.g. "Row 1 · Slot 3" (1-based). */
export function formatSponsorSlotLabel(sortOrder: number): string {
  const row = Math.floor(sortOrder / SPONSORS_PER_ROW) + 1;
  const slot = (sortOrder % SPONSORS_PER_ROW) + 1;
  return `Row ${row} · Slot ${slot}`;
}

/** Total grid cells to render through the last occupied row (multiple of 6). */
export function gridCellCountForSlots(sponsors: SponsorEntry[]): number {
  if (sponsors.length === 0) return 0;
  const maxSlot = Math.max(...sponsors.map((s) => s.sortOrder));
  return (Math.floor(maxSlot / SPONSORS_PER_ROW) + 1) * SPONSORS_PER_ROW;
}

export const sponsorConfigService = {
  async load(): Promise<SponsorConfig> {
    if (!isFirebaseEnabled()) return DEFAULT_CONFIG;
    const db = getFirebaseFirestore();
    if (!db) return DEFAULT_CONFIG;

    const snap = await getDoc(doc(db, FIRESTORE_PATHS.appConfigGlobal));
    if (!snap.exists()) return DEFAULT_CONFIG;

    const parsed = SponsorConfigSchema.safeParse({
      sponsorsEnabled: snap.data().sponsorsEnabled ?? false,
      sponsors: snap.data().sponsors ?? [],
      updatedAt: snap.data().updatedAt ?? Date.now(),
    });
    return parsed.success ? parsed.data : DEFAULT_CONFIG;
  },

  subscribe(callback: (config: SponsorConfig) => void): Unsubscribe {
    if (!isFirebaseEnabled()) {
      callback(DEFAULT_CONFIG);
      return () => undefined;
    }

    const db = getFirebaseFirestore();
    if (!db) {
      callback(DEFAULT_CONFIG);
      return () => undefined;
    }

    return onSnapshot(doc(db, FIRESTORE_PATHS.appConfigGlobal), (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_CONFIG);
        return;
      }
      const parsed = SponsorConfigSchema.safeParse({
        sponsorsEnabled: snap.data().sponsorsEnabled ?? false,
        sponsors: snap.data().sponsors ?? [],
        updatedAt: snap.data().updatedAt ?? Date.now(),
      });
      callback(parsed.success ? parsed.data : DEFAULT_CONFIG);
    });
  },

  async save(config: SponsorConfig): Promise<void> {
    if (!isFirebaseEnabled()) throw new Error('Firebase is not configured');
    const db = getFirebaseFirestore();
    if (!db) throw new Error('Firestore unavailable');

    const sponsors = sponsorConfigService.normalizeSponsors(config.sponsors).map((sponsor) => {
      const entry: Record<string, unknown> = {
        id: sponsor.id,
        name: sponsor.name,
        logoUrl: sponsor.logoUrl,
        sortOrder: sponsor.sortOrder,
      };
      if (sponsor.linkUrl) entry.linkUrl = sponsor.linkUrl;
      return entry;
    });

    await setDoc(
      doc(db, FIRESTORE_PATHS.appConfigGlobal),
      stripUndefinedDeep({
        sponsorsEnabled: config.sponsorsEnabled,
        sponsors,
        updatedAt: Date.now(),
      })
    );
  },

  normalizeSponsors(sponsors: SponsorEntry[]): SponsorEntry[] {
    const capped = sponsors.slice(0, MAX_SPONSOR_SLOTS);
    const usedSlots = new Set<number>();
    const result: SponsorEntry[] = [];

    for (const sponsor of capped) {
      let slot = sponsor.sortOrder;
      if (
        !Number.isInteger(slot) ||
        slot < 0 ||
        slot > MAX_SLOT_INDEX ||
        usedSlots.has(slot)
      ) {
        slot = findFirstFreeSlot(usedSlots);
      }
      if (slot > MAX_SLOT_INDEX) continue;

      usedSlots.add(slot);
      result.push({ ...sponsor, sortOrder: slot });
    }

    return result.sort((a, b) => a.sortOrder - b.sortOrder);
  },
};
