import {
  formatLadderStartNotice,
  formatPlayerNameList,
} from '@/modules/game-mode/ladderStartNotice';

describe('ladderStartNotice', () => {
  it('formats two-player lists with an ampersand', () => {
    expect(formatPlayerNameList(['Carmen', 'Jon'])).toBe('Carmen & Jon');
  });

  it('formats four-player lists with commas and a final ampersand', () => {
    expect(formatPlayerNameList(['Carmen', 'Jon', 'Jenny', 'Ben'])).toBe(
      'Carmen, Jon, Jenny & Ben'
    );
  });

  it('builds the auto-start notice sentence', () => {
    expect(formatLadderStartNotice('Winners Court', ['Carmen', 'Jon', 'Jenny', 'Ben'])).toBe(
      'Carmen, Jon, Jenny & Ben moved to Winners Court — game started'
    );
  });
});
