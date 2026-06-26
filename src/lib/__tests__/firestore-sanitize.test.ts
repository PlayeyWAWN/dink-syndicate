import { stripUndefinedDeep } from '@/lib/firestore-sanitize';

describe('stripUndefinedDeep', () => {
  it('removes undefined fields from nested objects', () => {
    expect(
      stripUndefinedDeep({
        activeMatches: [{ id: 'm1', startedAt: undefined, courtLabel: 'Court 1' }],
        rankings: [{ name: 'Alice', delta: undefined, rank: 1 }],
      })
    ).toEqual({
      activeMatches: [{ id: 'm1', courtLabel: 'Court 1' }],
      rankings: [{ name: 'Alice', rank: 1 }],
    });
  });
});
