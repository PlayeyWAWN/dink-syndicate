/** Application-wide constants and localStorage key namespace. */

export const APP_NAME = 'Dink Syndicate';
export const APP_TAGLINE = 'Ball Engagement Network';
export const APP_VERSION = '0.2.1';
/** Developer contact — Settings → App information. */
export const DEVELOPER_FACEBOOK_URL =
  'https://www.facebook.com/profile.php?id=61591397784939';
/** PWA logo — served from public/images/ (Vite static assets). */
export const LOGO_URL = '/images/logo.webp';

export const STORAGE_PREFIX = 'dinksyndicate';

export const STORAGE_KEYS = {
  APP_VERSION: `${STORAGE_PREFIX}_app_version`,
  THEME: `${STORAGE_PREFIX}_theme`,
  SESSION: `${STORAGE_PREFIX}_session`,
  ENHANCED_DATA: `${STORAGE_PREFIX}_enhanced_data`,
  ACTIVE_UID: `${STORAGE_PREFIX}_active_storage_uid`,
} as const;

export const DEFAULT_COURT_COUNT = 1;
export const DEFAULT_ORGANIZER_NAME = 'Queue Master';

/** Default manual DUPR-style rating for new players (queue balancing only). */
export const DEFAULT_DUPR_RATING = 3.5;
