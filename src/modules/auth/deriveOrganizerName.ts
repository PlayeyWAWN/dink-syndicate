import { DEFAULT_ORGANIZER_NAME } from '@/config/constants';

export interface DeriveOrganizerNameInput {
  displayName?: string | null;
  email?: string | null;
}

function titleCaseLocalPart(localPart: string): string {
  if (!localPart) return DEFAULT_ORGANIZER_NAME;
  return localPart.charAt(0).toUpperCase() + localPart.slice(1).toLowerCase();
}

/** Derive a non-empty organizer label from display name or email local-part. */
export function deriveOrganizerName(input: DeriveOrganizerNameInput): string {
  const display = input.displayName?.trim();
  if (display) return display;

  const email = input.email?.trim();
  if (email && email.includes('@')) {
    const localPart = email.split('@')[0]?.trim();
    if (localPart) return titleCaseLocalPart(localPart);
  }

  return DEFAULT_ORGANIZER_NAME;
}

/** Normalize organizer input — never returns empty string. */
export function normalizeOrganizerName(
  name: string,
  fallback?: DeriveOrganizerNameInput
): string {
  const trimmed = name.trim();
  if (trimmed) return trimmed;
  if (fallback) return deriveOrganizerName(fallback);
  return DEFAULT_ORGANIZER_NAME;
}
