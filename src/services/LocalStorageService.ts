import { AppData, migrateAppData } from '@/types/app-data';
import { readEnhancedData, writeEnhancedData } from '@/services/storage-scope';

/** Typed localStorage read/write for the full app snapshot. */
export class LocalStorageService {
  load(uid?: string | null): AppData | null {
    const raw = readEnhancedData<unknown>(uid);
    if (!raw) return null;
    try {
      return migrateAppData(raw);
    } catch {
      return null;
    }
  }

  save(data: AppData, uid?: string | null): boolean {
    const validated = migrateAppData(data);
    return writeEnhancedData(validated, uid);
  }

  exportJson(data: AppData): string {
    return JSON.stringify(migrateAppData(data), null, 2);
  }

  importJson(json: string): AppData {
    const raw = JSON.parse(json) as unknown;
    return migrateAppData(raw);
  }
}

export const localStorageService = new LocalStorageService();
