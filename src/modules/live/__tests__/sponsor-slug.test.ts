import { resolveSponsorSlug, slugifySponsorName } from '@/modules/live/sponsor-slug';

describe('sponsor slug', () => {
  it('slugifies sponsor names', () => {
    expect(slugifySponsorName('Acme Pickleball')).toBe('acme-pickleball');
    expect(slugifySponsorName("Joe's Sports Bar")).toBe('joes-sports-bar');
  });

  it('resolves collisions with numeric suffix', () => {
    expect(resolveSponsorSlug('Acme Pickleball', ['acme-pickleball'])).toBe('acme-pickleball-2');
  });
});
