/**
 * Shared UI icons (Iconify sets) — inline SVG for offline PWA use.
 * @see https://icon-sets.iconify.design/
 */
import { playerActionIconHtml } from '@/ui/icons/player-action-icons';
import { pickleballIconHtml } from '@/ui/icons/pickleball-icon';

const SVG_24 =
  'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"';

const SVG_32 =
  'xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" focusable="false"';

export type AppIconId =
  | 'user-male'
  | 'user-female'
  | 'checked-in'
  | 'not-checked-in'
  | 'active'
  | 'excluded'
  | 'announce'
  | 'delete'
  | 'check'
  | 'play'
  | 'pickleball'
  | 'synergy'
  | 'tier-early'
  | 'tier-on-time'
  | 'tier-grace'
  | 'tier-late'
  | 'tier-very-late'
  | 'tier-not-checked-in';

/** @see https://icon-sets.iconify.design/icons8/user-male/ */
const USER_MALE = `<svg ${SVG_32}><path d="M18 4c-3.666 0-6.446.862-8.313 2.625C7.822 8.388 7 10.958 7 14v.906C6.428 15.45 6 16.15 6 17c0 1.26.89 2.154 2 2.594c.37 1.167.773 2.393 1.22 3.437c.485 1.142.924 2.048 1.53 2.69a7.19 7.19 0 0 0 10.5 0c.606-.642 1.013-1.548 1.5-2.69c.446-1.044.88-2.27 1.25-3.436c1.11-.44 2-1.334 2-2.594c0-.846-.43-1.547-1-2.094V14c0-2.824-.643-4.834-1.78-6.156c-.966-1.12-2.255-1.58-3.532-1.72l-.782-1.56l-.28-.564zm-.594 2.063l.688 1.375c.333.666.463 1.14.468 1.343s.013.12-.03.158c-.087.073-.93.29-1.97.343s-2.264.028-3.406.47c-1.14.442-2.143 1.627-2.156 3.25h2c.008-.986.237-1.128.875-1.375s1.738-.32 2.813-.375c1.074-.055 2.183.01 3.125-.78c.47-.397.77-1.08.75-1.75c-.005-.148-.04-.29-.063-.44a3.2 3.2 0 0 1 1.188.876C22.413 10 23 11.482 23 14v1.844l.5.28c.304.177.5.496.5.876a.98.98 0 0 1-.906 1l-.688.03l-.187.657a38 38 0 0 1-1.282 3.532c-.45 1.056-.967 1.956-1.125 2.124c-2.13 2.25-5.497 2.25-7.625 0c-.16-.168-.675-1.068-1.126-2.125a38 38 0 0 1-1.28-3.532l-.188-.657l-.688-.03A.98.98 0 0 1 8 17c0-.374.193-.698.5-.875l.5-.28V14c0-2.697.684-4.636 2.063-5.938c1.28-1.21 3.37-1.9 6.343-2zM13 16a1 1 0 1 0 0 2a1 1 0 0 0 0-2m6 0a1 1 0 1 0 0 2a1 1 0 0 0 0-2"/></svg>`;

/** @see https://icon-sets.iconify.design/icons8/user-female/ */
const USER_FEMALE = `<svg ${SVG_32}><path d="M18.125 4c-3.304 0-6.984.562-9.72 3.594C5.673 10.626 4 15.88 4 25v1h8.656c.99.625 2.103 1 3.344 1s2.355-.383 3.344-1H29v-1c0-8.125-1.57-12.844-3.625-15.594c-1.81-2.42-3.892-3.094-5.438-3.25L19 4.5l-.28-.5zm-.563 2.063l.813 1.437l.28.5h.595c1.01 0 2.848.34 4.53 2.594C25.386 12.74 26.8 16.83 26.938 24h-5.375c.11-.14.21-.292.313-.438C23.233 21.625 24 19.207 24 17h-2c0 1.722-.644 3.827-1.75 5.406C19.144 23.986 17.665 25 16 25c-1.663 0-3.143-1.01-4.25-2.594C10.643 20.824 10 18.71 10 17c0-.444.085-.667.22-.844c.132-.177.364-.33.717-.468c.707-.28 1.9-.395 3.157-.5c1.258-.106 2.57-.206 3.75-.75C19.024 13.893 20 12.66 20 11h-2c0 1.044-.274 1.304-.97 1.625c-.694.32-1.882.458-3.124.563s-2.55.163-3.72.624c-.583.23-1.148.578-1.56 1.126C8.21 15.485 8 16.218 8 17c0 2.198.768 4.59 2.125 6.53q.165.241.344.47H6.06c.135-8.163 1.71-12.696 3.844-15.063c2.088-2.314 4.783-2.815 7.656-2.874zM13 17a1 1 0 1 0 0 2a1 1 0 0 0 0-2m6 0a1 1 0 1 0 0 2a1 1 0 0 0 0-2"/></svg>`;

const ICONS: Record<Exclude<AppIconId, 'delete' | 'pickleball'>, string> = {
  'user-male': USER_MALE,
  'user-female': USER_FEMALE,
  'checked-in': `<svg ${SVG_24}><path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2"/></svg>`,
  'not-checked-in': `<svg ${SVG_24}><path d="M6 2h12v6l-4 4l4 4v6H6v-6l4-4l-4-4zm10 14.5l-4-4l-4 4V20h8zm-4-5l4-4V4H8v3.5zM10 6h4v.75l-2 2l-2-2z"/></svg>`,
  active: `<svg ${SVG_24}><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10s10-4.5 10-10S17.5 2 12 2m-2 15l-5-5l1.41-1.41L10 14.17l7.59-7.59L19 8z"/></svg>`,
  excluded: `<svg ${SVG_24}><path d="M12 2c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 17.5 2 12S6.5 2 12 2m0 2c-1.9 0-3.6.6-4.9 1.7l11.2 11.2c1-1.4 1.7-3.1 1.7-4.9c0-4.4-3.6-8-8-8m4.9 14.3L5.7 7.1C4.6 8.4 4 10.1 4 12c0 4.4 3.6 8 8 8c1.9 0 3.6-.6 4.9-1.7"/></svg>`,
  announce: `<svg ${SVG_24}><path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.84-5 6.7v2.07c4-.91 7-4.49 7-8.77s-3-7.86-7-8.77M16.5 12c0-1.77-1-3.29-2.5-4.03V16c1.5-.71 2.5-2.24 2.5-4M3 9v6h4l5 5V4L7 9z"/></svg>`,
  check: `<svg ${SVG_24}><path d="M21 7L9 19l-5.5-5.5l1.41-1.41L9 16.17L19.59 5.59z"/></svg>`,
  play: `<svg ${SVG_24}><path d="M8 5.14v14l11-7z"/></svg>`,
  /** Linked partners — Synergy Team lock indicator. */
  synergy: `<svg ${SVG_24}><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1M8 13h8v-2H8v2m9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5"/></svg>`,
  'tier-early': `<svg ${SVG_24}><path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2"/></svg>`,
  'tier-on-time': `<svg ${SVG_24}><path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2"/></svg>`,
  'tier-grace': `<svg ${SVG_24}><path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2"/></svg>`,
  'tier-late': `<svg ${SVG_24}><path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2"/></svg>`,
  'tier-very-late': `<svg ${SVG_24}><path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2"/></svg>`,
  'tier-not-checked-in': `<svg ${SVG_24}><path d="M12 20a8 8 0 0 1-8-8a8 8 0 0 1 8-8a8 8 0 0 1 8 8a8 8 0 0 1-8 8m0-18A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2"/></svg>`,
};

export function genderAppIconId(gender: 'male' | 'female'): AppIconId {
  return gender === 'female' ? 'user-female' : 'user-male';
}

export function appIconHtml(id: AppIconId): string {
  if (id === 'delete') return playerActionIconHtml('delete');
  if (id === 'pickleball') return pickleballIconHtml();
  return ICONS[id];
}

export function mountAppIcon(container: HTMLElement, id: AppIconId): void {
  container.innerHTML = appIconHtml(id);
  container.classList.add('app-icon', `app-icon--${id}`);
}

export function createAppIcon(id: AppIconId, className = ''): HTMLSpanElement {
  const icon = document.createElement('span');
  icon.className = ['app-icon', `app-icon--${id}`, className].filter(Boolean).join(' ');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = appIconHtml(id);
  return icon;
}

export function createAppIconLabel(
  iconId: AppIconId,
  text: string,
  className = ''
): HTMLSpanElement {
  const wrap = document.createElement('span');
  wrap.className = ['app-icon-label', className].filter(Boolean).join(' ');
  const label = document.createElement('span');
  label.className = 'app-icon-label__text';
  label.textContent = text;
  wrap.append(createAppIcon(iconId), label);
  return wrap;
}
