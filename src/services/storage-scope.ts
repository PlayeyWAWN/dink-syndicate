import { STORAGE_KEYS } from '@/config/constants';

/** In-memory active UID for Phase 2 Firebase scoping; Phase 1 uses local session id. */
let activeStorageUid: string | null = null;

export function getActiveStorageUid(): string | null {
  if (typeof window === 'undefined') return activeStorageUid;
  if (activeStorageUid) return activeStorageUid;
  try {
    return sessionStorage.getItem(STORAGE_KEYS.ACTIVE_UID);
  } catch {
    return null;
  }
}

export function setActiveStorageUid(uid: string | null | undefined): void {
  const normalized = uid ? String(uid) : null;
  activeStorageUid = normalized;
  if (typeof window === 'undefined') return;
  try {
    if (normalized) {
      sessionStorage.setItem(STORAGE_KEYS.ACTIVE_UID, normalized);
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_UID);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function getEnhancedDataKey(uid?: string | null): string {
  const id = uid !== undefined ? uid : getActiveStorageUid();
  return id ? `${STORAGE_KEYS.ENHANCED_DATA}_${id}` : STORAGE_KEYS.ENHANCED_DATA;
}

export function migrateGlobalEnhancedDataToUid(uid: string): boolean {
  if (!uid || typeof localStorage === 'undefined') return false;
  const scopedKey = getEnhancedDataKey(uid);
  if (localStorage.getItem(scopedKey)) return false;
  const global = localStorage.getItem(STORAGE_KEYS.ENHANCED_DATA);
  if (!global) return false;
  try {
    localStorage.setItem(scopedKey, global);
    return true;
  } catch {
    return false;
  }
}

export function readEnhancedData<T = unknown>(uid?: string | null): T | null {
  if (typeof localStorage === 'undefined') return null;
  const id = uid !== undefined ? uid : getActiveStorageUid();
  if (id) migrateGlobalEnhancedDataToUid(id);
  const key = getEnhancedDataKey(id);
  let raw = localStorage.getItem(key);
  if (!raw && id) {
    raw = localStorage.getItem(STORAGE_KEYS.ENHANCED_DATA);
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeEnhancedData(data: unknown, uid?: string | null): boolean {
  if (typeof localStorage === 'undefined') return false;
  const key = getEnhancedDataKey(uid);
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function removeEnhancedData(uid?: string | null): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(getEnhancedDataKey(uid));
}
