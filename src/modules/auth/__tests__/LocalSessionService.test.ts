import { LocalSessionService } from '@/modules/auth/LocalSessionService';
import { STORAGE_KEYS } from '@/config/constants';

describe('LocalSessionService', () => {
  it('creates a local session on first signIn', async () => {
    const service = new LocalSessionService();
    const session = await service.signIn();
    expect(session.id).toBeTruthy();
    expect(session.organizerName).toBe('Queue Master');
    expect(localStorage.getItem(STORAGE_KEYS.SESSION)).toBeTruthy();
  });

  it('reuses persisted session', async () => {
    const first = new LocalSessionService();
    const created = await first.signIn();
    const second = new LocalSessionService();
    const restored = await second.signIn();
    expect(restored.id).toBe(created.id);
  });

  it('updates organizer name', async () => {
    const service = new LocalSessionService();
    await service.signIn();
    const updated = service.updateOrganizerName('Club Host');
    expect(updated.organizerName).toBe('Club Host');
  });
});
