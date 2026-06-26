import { isAppOwner } from '@/modules/auth/isAppOwner';
import { Session } from '@/types/session';

describe('isAppOwner', () => {
  const base: Session = {
    id: '1',
    organizerName: 'Test',
    email: 'benedictramosgarcia@gmail.com',
    role: 'queue_master',
    createdAt: 0,
  };

  it('returns true for owner email', () => {
    expect(isAppOwner(base)).toBe(true);
    expect(isAppOwner({ ...base, email: 'Benedictramosgarcia@Gmail.com' })).toBe(true);
  });

  it('returns false for other users', () => {
    expect(isAppOwner({ ...base, email: 'other@example.com' })).toBe(false);
    expect(isAppOwner(null)).toBe(false);
  });
});
