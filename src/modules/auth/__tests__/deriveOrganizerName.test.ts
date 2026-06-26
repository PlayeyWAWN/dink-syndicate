import { deriveOrganizerName, normalizeOrganizerName } from '@/modules/auth/deriveOrganizerName';

describe('deriveOrganizerName', () => {
  it('uses display name when present', () => {
    expect(deriveOrganizerName({ displayName: 'Benedict Club', email: 'a@b.com' })).toBe(
      'Benedict Club'
    );
  });

  it('title-cases email local part', () => {
    expect(deriveOrganizerName({ email: 'benedictramosgarcia@gmail.com' })).toBe(
      'Benedictramosgarcia'
    );
  });

  it('normalizeOrganizerName rejects empty without fallback', () => {
    expect(normalizeOrganizerName('')).toBe('Queue Master');
  });
});
