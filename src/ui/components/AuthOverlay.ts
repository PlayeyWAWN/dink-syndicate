import { APP_NAME, LOGO_URL } from '@/config/constants';
import { formatAuthError } from '@/lib/firebase-auth-errors';
import { el } from '@/lib/dom-utils';
import { getFirebaseAuthService } from '@/modules/auth/getAuthService';

export interface AuthOverlayController {
  show: () => void;
  hide: () => void;
  destroy: () => void;
}

function setFormLoading(button: HTMLButtonElement, loading: boolean): void {
  const spinner = button.querySelector('.auth-loading-spinner');
  button.disabled = loading;
  if (spinner instanceof HTMLElement) {
    spinner.hidden = !loading;
  }
}

function showForm(formId: 'login' | 'signup'): void {
  const loginForm = document.getElementById('auth-login-form');
  const signupForm = document.getElementById('auth-signup-form');
  loginForm?.classList.toggle('auth-form--active', formId === 'login');
  signupForm?.classList.toggle('auth-form--active', formId === 'signup');
}

/** Full-screen Smash-style auth overlay with Google + email sign-in. */
export function mountAuthOverlay(): AuthOverlayController {
  const auth = getFirebaseAuthService();
  if (!auth) {
    throw new Error('Firebase Auth is not configured');
  }

  const overlay = el('div', {
    className: 'auth-overlay',
    id: 'auth-overlay',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Sign in',
  });

  const container = el('div', { className: 'auth-container' });

  const logoWrap = el('div', { className: 'auth-logo' });
  const logoImg = el('img', { src: LOGO_URL, alt: `${APP_NAME} logo` }) as HTMLImageElement;
  logoWrap.append(logoImg);

  container.append(
    logoWrap,
    el('div', { className: 'auth-title' }, [APP_NAME]),
    el('div', { className: 'auth-subtitle' }, [
      'Sign in to access your Pickleball Engagement Network System',
    ])
  );

  const loginError = el('div', { className: 'auth-error', id: 'auth-login-error' });
  const loginForm = el('form', { className: 'auth-form auth-form--active', id: 'auth-login-form' });
  const loginEmail = el('input', {
    type: 'email',
    className: 'auth-input',
    id: 'auth-login-email',
    placeholder: 'Email',
    autocomplete: 'email',
  }) as HTMLInputElement;
  loginEmail.required = true;
  const loginPassword = el('input', {
    type: 'password',
    className: 'auth-input',
    id: 'auth-login-password',
    placeholder: 'Password',
    autocomplete: 'current-password',
  }) as HTMLInputElement;
  loginPassword.required = true;
  const loginBtn = el('button', { type: 'submit', className: 'auth-btn', id: 'auth-login-btn' }, [
    el('span', { className: 'auth-loading-spinner', hidden: '' }),
    'Sign In',
  ]) as HTMLButtonElement;

  const googleBtnLogin = el('button', { type: 'button', className: 'google-btn' }, [
    el('div', { className: 'google-icon' }, ['G']),
    'Continue with Google',
  ]) as HTMLButtonElement;

  googleBtnLogin.addEventListener('click', async () => {
    loginError.textContent = '';
    setFormLoading(googleBtnLogin, true);
    try {
      await auth.signInWithGoogle();
    } catch (error) {
      loginError.textContent = formatAuthError(error);
    } finally {
      setFormLoading(googleBtnLogin, false);
    }
  });

  loginForm.append(
    loginError,
    googleBtnLogin,
    el('div', { className: 'auth-divider' }, [el('span', {}, ['or sign in with email'])]),
    loginEmail,
    loginPassword,
    loginBtn,
    el('button', { type: 'button', className: 'auth-toggle' }, ["Don't have an account? Sign up"])
  );

  loginForm.querySelector('.auth-toggle')?.addEventListener('click', () => {
    loginError.textContent = '';
    showForm('signup');
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.textContent = '';
    setFormLoading(loginBtn, true);
    try {
      await auth.signInWithEmail(loginEmail.value, loginPassword.value);
    } catch (error) {
      loginError.textContent = formatAuthError(error);
    } finally {
      setFormLoading(loginBtn, false);
    }
  });

  const signupError = el('div', { className: 'auth-error', id: 'auth-signup-error' });
  const signupSuccess = el('div', { className: 'auth-success', id: 'auth-signup-success' });
  const signupForm = el('form', { className: 'auth-form', id: 'auth-signup-form' });
  const signupName = el('input', {
    type: 'text',
    className: 'auth-input',
    id: 'auth-signup-name',
    placeholder: 'Full Name',
    autocomplete: 'name',
  }) as HTMLInputElement;
  signupName.required = true;
  const signupEmail = el('input', {
    type: 'email',
    className: 'auth-input',
    id: 'auth-signup-email',
    placeholder: 'Email',
    autocomplete: 'email',
  }) as HTMLInputElement;
  signupEmail.required = true;
  const signupPassword = el('input', {
    type: 'password',
    className: 'auth-input',
    id: 'auth-signup-password',
    placeholder: 'Password (min 6 characters)',
    autocomplete: 'new-password',
  }) as HTMLInputElement;
  signupPassword.required = true;
  const signupConfirm = el('input', {
    type: 'password',
    className: 'auth-input',
    id: 'auth-signup-confirm',
    placeholder: 'Confirm Password',
    autocomplete: 'new-password',
  }) as HTMLInputElement;
  signupConfirm.required = true;
  const signupBtn = el('button', { type: 'submit', className: 'auth-btn', id: 'auth-signup-btn' }, [
    el('span', { className: 'auth-loading-spinner', hidden: '' }),
    'Create Account',
  ]) as HTMLButtonElement;

  const googleBtnSignup = el('button', { type: 'button', className: 'google-btn' }, [
    el('div', { className: 'google-icon' }, ['G']),
    'Continue with Google',
  ]) as HTMLButtonElement;

  googleBtnSignup.addEventListener('click', async () => {
    signupError.textContent = '';
    signupSuccess.textContent = '';
    setFormLoading(googleBtnSignup, true);
    try {
      await auth.signInWithGoogle();
    } catch (error) {
      signupError.textContent = formatAuthError(error);
    } finally {
      setFormLoading(googleBtnSignup, false);
    }
  });

  signupForm.append(
    signupError,
    signupSuccess,
    googleBtnSignup,
    el('div', { className: 'auth-divider' }, [el('span', {}, ['or create account with email'])]),
    signupName,
    signupEmail,
    signupPassword,
    signupConfirm,
    signupBtn,
    el('button', { type: 'button', className: 'auth-toggle' }, ['Already have an account? Sign in'])
  );

  signupForm.querySelector('.auth-toggle')?.addEventListener('click', () => {
    signupError.textContent = '';
    signupSuccess.textContent = '';
    showForm('login');
  });

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    signupError.textContent = '';
    signupSuccess.textContent = '';

    if (signupPassword.value !== signupConfirm.value) {
      signupError.textContent = 'Passwords do not match';
      return;
    }
    if (signupPassword.value.length < 6) {
      signupError.textContent = 'Password must be at least 6 characters';
      return;
    }

    setFormLoading(signupBtn, true);
    try {
      await auth.registerWithEmail(signupEmail.value, signupPassword.value, signupName.value);
      signupSuccess.textContent = 'Account created successfully!';
    } catch (error) {
      signupError.textContent = formatAuthError(error);
    } finally {
      setFormLoading(signupBtn, false);
    }
  });

  container.append(loginForm, signupForm);
  overlay.append(container);
  document.body.append(overlay);

  return {
    show: () => {
      overlay.hidden = false;
    },
    hide: () => {
      overlay.hidden = true;
    },
    destroy: () => {
      overlay.remove();
    },
  };
}
