import { isFirebaseEnabled } from '@/config/firebase';
import { el } from '@/lib/dom-utils';
import { getAuthService } from '@/modules/auth/getAuthService';
import { showAuthOverlay } from '@/app/auth-gate';
import { useSessionStore } from '@/stores/sessionStore';

/** Settings panel — signed-in account and sign out (Firebase only). */
export function renderAccountSettingsPanel(): HTMLElement {
  const section = el('div', { className: 'card settings-section settings-section--static' });
  section.append(el('h3', {}, ['Account']));

  if (!isFirebaseEnabled()) {
    section.append(
      el('p', { className: 'screen-lead' }, [
        'Running in local-only mode. Cloud sign-in is enabled when Firebase environment variables are configured at build time.',
      ])
    );
    return section;
  }

  const session = useSessionStore.getState().session;
  const emailLine = el('p', { className: 'screen-lead settings-preview', id: 'settings-signed-in-email' }, [
    session ? `Signed in as ${session.organizerName}` : 'Not signed in',
  ]);

  const signOutBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Sign out']);
  signOutBtn.addEventListener('click', async () => {
    const confirmed = window.confirm('Sign out and return to the login screen?');
    if (!confirmed) return;
    await getAuthService().signOut();
    showAuthOverlay();
  });

  section.append(
    emailLine,
    el('p', { className: 'screen-lead' }, [
      'Sign out of your account and return to the login screen.',
    ]),
    signOutBtn
  );

  return section;
}
