import { STORAGE_KEYS } from '@/config/constants';
import {
  getEnhancedDataKey,
  readEnhancedData,
  setActiveStorageUid,
  writeEnhancedData,
} from '@/services/storage-scope';

describe('storage-scope', () => {
  it('scopes enhanced data by active uid', () => {
    setActiveStorageUid('session-abc');
    writeEnhancedData({ players: [] });
    expect(getEnhancedDataKey()).toBe(`${STORAGE_KEYS.ENHANCED_DATA}_session-abc`);
    expect(readEnhancedData()).toEqual({ players: [] });
  });

  it('migrates global blob to uid-scoped key on read', () => {
    localStorage.setItem(STORAGE_KEYS.ENHANCED_DATA, JSON.stringify({ version: 1 }));
    setActiveStorageUid('uid-1');
    const data = readEnhancedData();
    expect(data).toEqual({ version: 1 });
    expect(localStorage.getItem(`${STORAGE_KEYS.ENHANCED_DATA}_uid-1`)).toBeTruthy();
  });
});
