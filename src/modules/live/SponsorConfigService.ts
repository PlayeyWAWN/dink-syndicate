import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/config/firebase-app';
import { isFirebaseEnabled } from '@/config/firebase';
import { FIRESTORE_PATHS } from '@/modules/live/firestore-paths';
import { SponsorConfig, SponsorConfigSchema, SponsorEntry } from '@/types/live';

const DEFAULT_CONFIG: SponsorConfig = {
  sponsorsEnabled: false,
  sponsors: [],
  updatedAt: Date.now(),
};

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

    await setDoc(doc(db, FIRESTORE_PATHS.appConfigGlobal), {
      ...config,
      updatedAt: Date.now(),
    });
  },

  normalizeSponsors(sponsors: SponsorEntry[]): SponsorEntry[] {
    return sponsors
      .slice(0, 18)
      .map((s, index) => ({ ...s, sortOrder: index }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
};
