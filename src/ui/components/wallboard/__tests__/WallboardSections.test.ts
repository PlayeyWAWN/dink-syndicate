import { renderWallboardQueue, renderWallboardSponsors } from '@/ui/components/wallboard/WallboardSections';
import { PublicPlayer, PublicQueueEntry, SponsorConfig } from '@/types/live';

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

describe('renderWallboardQueue', () => {
  it('clamps oversized stack queue entries to a 2v2 doubles lineup', () => {
    const players: PublicPlayer[] = Array.from({ length: 8 }, (_, index) => ({
      id: `p${index + 1}`,
      name: `Player ${index + 1}`,
      gamesPlayed: 1,
      wins: 0,
      losses: 1,
    }));
    const queueNext: PublicQueueEntry[] = [
      {
        position: 1,
        playerIds: players.map((player) => player.id),
        label: 'Stale winners vs losers',
        format: 'doubles',
      },
    ];

    const section = renderWallboardQueue(queueNext, players);
    const chips = section.querySelectorAll('.match-player-chip');
    // Four player chips total (2 per team) — not 8 from a stale stack dump.
    expect(chips.length).toBe(4);
  });
});
