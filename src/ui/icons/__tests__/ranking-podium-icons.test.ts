import { getPodiumRank } from '@/ui/icons/ranking-podium-icons';

describe('ranking-podium-icons', () => {
  it('maps the first three ranks to podium positions', () => {
    expect(getPodiumRank(0)).toBe(1);
    expect(getPodiumRank(1)).toBe(2);
    expect(getPodiumRank(2)).toBe(3);
    expect(getPodiumRank(3)).toBeNull();
  });
});
