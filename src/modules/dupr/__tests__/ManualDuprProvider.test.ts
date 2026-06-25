import { ManualDuprProvider } from '@/modules/dupr/ManualDuprProvider';

describe('ManualDuprProvider', () => {
  const provider = new ManualDuprProvider();

  it('reports unavailable in Phase 1', () => {
    expect(provider.isAvailable()).toBe(false);
  });

  it('rejects connectPlayer until Phase 3', async () => {
    await expect(provider.connectPlayer()).rejects.toThrow(/Phase 3/);
  });
});
