/** Map Firebase Auth error codes to user-facing messages. */
export function getFirebaseAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/user-not-found':
      return 'No account found with this email';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password';
    case 'auth/invalid-email':
      return 'Invalid email address';
    case 'auth/weak-password':
      return 'Password is too weak (minimum 6 characters)';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection and try again';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is disabled in Firebase. Enable it in the console';
    case 'auth/popup-closed-by-user':
      return 'The sign-in popup was closed before completing';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for sign-in. Add it in Firebase Authentication settings';
    case 'auth/internal-error':
      return 'Unexpected error. Please try again';
    default:
      return errorCode ? `An error occurred (${errorCode}). Please try again` : 'An error occurred. Please try again';
  }
}

export function formatAuthError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return getFirebaseAuthErrorMessage(String((error as { code: string }).code));
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'An error occurred. Please try again';
}
