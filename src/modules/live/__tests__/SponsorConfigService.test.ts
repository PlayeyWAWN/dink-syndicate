import {
  findFirstFreeSlot,
  formatSponsorSlotLabel,
  gridCellCountForSlots,
  sponsorConfigService,
} from '@/modules/live/SponsorConfigService';
import { SponsorEntry } from '@/types/live';

function entry(id: string, sortOrder: number): SponsorEntry {
  return {
    id,
    name: id,
    logoUrl: `https://example.com/${id}.webp`,
    sortOrder,
  };
}

describe('findFirstFreeSlot', () => {
  it('returns the lowest unused slot index', () => {
    expect(findFirstFreeSlot(new Set([0, 1, 2]))).toBe(3);
    expect(findFirstFreeSlot(new Set([0, 2]))).toBe(1);
    expect(findFirstFreeSlot(new Set())).toBe(0);
  });

  it('returns 18 when all slots are used', () => {
    const used = new Set(Array.from({ length: 18 }, (_, i) => i));
    expect(findFirstFreeSlot(used)).toBe(18);
  });
});

describe('formatSponsorSlotLabel', () => {
  it('formats row and slot as 1-based labels', () => {
    expect(formatSponsorSlotLabel(0)).toBe('Row 1 · Slot 1');
    expect(formatSponsorSlotLabel(2)).toBe('Row 1 · Slot 3');
    expect(formatSponsorSlotLabel(6)).toBe('Row 2 · Slot 1');
  });
});

describe('gridCellCountForSlots', () => {
  it('returns zero for an empty list', () => {
    expect(gridCellCountForSlots([])).toBe(0);
  });

  it('pads to full rows through the highest occupied slot', () => {
    expect(gridCellCountForSlots([entry('a', 2), entry('b', 3)])).toBe(6);
    expect(gridCellCountForSlots([entry('a', 8)])).toBe(12);
  });
});

describe('normalizeSponsors', () => {
  it('preserves explicit slot assignments', () => {
    const normalized = sponsorConfigService.normalizeSponsors([
      entry('a', 2),
      entry('b', 3),
    ]);
    expect(normalized.map((s) => s.sortOrder)).toEqual([2, 3]);
  });

  it('assigns the first free slot when sortOrder is invalid or duplicate', () => {
    const normalized = sponsorConfigService.normalizeSponsors([
      entry('a', 2),
      entry('b', 2),
      entry('c', 99),
    ]);
    expect(normalized.find((s) => s.id === 'a')?.sortOrder).toBe(2);
    expect(normalized.find((s) => s.id === 'b')?.sortOrder).toBe(0);
    expect(normalized.find((s) => s.id === 'c')?.sortOrder).toBe(1);
  });
});
