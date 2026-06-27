import { renderWallboardSponsors } from '@/ui/components/wallboard/WallboardSections';
import { SponsorConfig } from '@/types/live';

describe('renderWallboardSponsors', () => {
  it('renders empty spacer cells before and after centered sponsors', () => {
    const config: SponsorConfig = {
      sponsorsEnabled: true,
      updatedAt: Date.now(),
      sponsors: [
        {
          id: 'a',
          name: 'Sponsor A',
          logoUrl: 'https://example.com/a.webp',
          sortOrder: 2,
        },
        {
          id: 'b',
          name: 'Sponsor B',
          logoUrl: 'https://example.com/b.webp',
          sortOrder: 3,
        },
      ],
    };

    const section = renderWallboardSponsors(config);
    expect(section).not.toBeNull();

    const slots = section!.querySelectorAll('.live-wallboard__sponsor-slot');
    expect(slots.length).toBe(6);
    expect(slots[0].classList.contains('live-wallboard__sponsor-slot--empty')).toBe(true);
    expect(slots[1].classList.contains('live-wallboard__sponsor-slot--empty')).toBe(true);
    expect(slots[2].querySelector('.live-wallboard__sponsor-logo')).not.toBeNull();
    expect(slots[3].querySelector('.live-wallboard__sponsor-logo')).not.toBeNull();
    expect(slots[4].classList.contains('live-wallboard__sponsor-slot--empty')).toBe(true);
    expect(slots[5].classList.contains('live-wallboard__sponsor-slot--empty')).toBe(true);
  });
});
