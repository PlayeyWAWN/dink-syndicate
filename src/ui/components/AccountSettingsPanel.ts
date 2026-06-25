import { isFirebaseEnabled } from '@/config/firebase';
import { getFirebaseAuth } from '@/config/firebase-app';
import { el } from '@/lib/dom-utils';
import { getAuthService } from '@/modules/auth/getAuthService';
import { showAuthOverlay } from '@/app/auth-gate';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsUiStore } from '@/stores/settingsUiStore';
import { renderSettingsCollapsibleSection } from '@/ui/components/SettingsCollapsibleSection';

/** Settings → Account management — sign out and signed-in email. */
export function renderAccountSettingsPanel(): HTMLElement {
  const settingsUi = useSettingsUiStore.getState();

  const body: HTMLElement[] = [];

  if (!isFirebaseEnabled()) {
    body.push(
      el('p', { className: 'screen-lead' }, [
        'Running in local-only mode. Cloud sign-in is enabled when Firebase environment variables are configured at build time.',
      ])
    );
  } else {
    const session = useSessionStore.getState().session;
    const signedInEmail =
      session?.email ?? getFirebaseAuth()?.currentUser?.email ?? 'Not signed in';

    const signOutBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Sign out']);
    signOutBtn.addEventListener('click', async () => {
      const confirmed = window.confirm('Sign out and return to the login screen?');
      if (!confirmed) return;
      await getAuthService().signOut();
      showAuthOverlay();
    });

    body.push(
      el('p', { className: 'screen-lead' }, [
        'Sign out of your account and return to the login screen.',
      ]),
      signOutBtn,
      el('p', {
        className: 'settings-account-email',
        id: 'settings-signed-in-email',
      }, [signedInEmail])
    );
  }

  return renderSettingsCollapsibleSection(body, {
    title: 'Account management',
    open: settingsUi.accountSectionOpen,
    onToggle: (open) => useSettingsUiStore.getState().setAccountSectionOpen(open),
  });
}
