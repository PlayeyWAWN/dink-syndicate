import {
  lineupCompositionKey,
  syncAutoPreviewFilledAt,
} from '@/stores/queueUiStore';

describe('syncAutoPreviewFilledAt', () => {
  it('stamps new complete compositions', () => {
    const lineups = [
      ['a', 'b', 'c', 'd'],
      ['e', 'f', 'g', 'h'],
    ];
    const synced = syncAutoPreviewFilledAt(lineups, [], [], 1000);
    expect(synced.keys).toEqual([
      lineupCompositionKey(lineups[0]!),
      lineupCompositionKey(lineups[1]!),
    ]);
    expect(synced.filledAt).toEqual([1000, 1000]);
  });

  it('keeps stamp when the same composition remains', () => {
    const lineup = ['a', 'b', 'c', 'd'];
    const key = lineupCompositionKey(lineup);
    const synced = syncAutoPreviewFilledAt(
      [lineup],
      [key],
      [500],
      2000
    );
    expect(synced.filledAt).toEqual([500]);
  });

  it('keeps stamp when a lineup shifts from card 1 to Next', () => {
    const first = ['a', 'b', 'c', 'd'];
    const second = ['e', 'f', 'g', 'h'];
    const previous = syncAutoPreviewFilledAt([first, second], [], [], 1000);

    // First game started — former Lineup 2 is now Next.
    const afterStart = syncAutoPreviewFilledAt(
      [second],
      previous.keys,
      previous.filledAt,
      2500
    );
    expect(afterStart.keys).toEqual([lineupCompositionKey(second)]);
    expect(afterStart.filledAt).toEqual([previous.filledAt[1]]);
  });

  it('stamps again when composition changes', () => {
    const previousKey = lineupCompositionKey(['a', 'b', 'c', 'd']);
    const synced = syncAutoPreviewFilledAt(
      [['a', 'c', 'b', 'd']],
      [previousKey],
      [500],
      3000
    );
    expect(synced.filledAt).toEqual([3000]);
  });
});
