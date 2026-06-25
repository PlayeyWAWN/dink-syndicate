/** Top-down pickleball court SVG — Midnight & Slate palette. */

export interface CourtSvgOptions {
  width?: number;
  height?: number;
  active?: boolean;
  label?: string;
}

const COLORS = {
  surface: '#475569',
  surfaceBorder: '#64748b',
  kitchen: 'rgba(56, 189, 248, 0.28)',
  kitchenActive: 'rgba(56, 189, 248, 0.42)',
  lines: '#f8fafc',
  net: '#0f172a',
};

/** Renders a horizontal top-down court matching the reference layout. */
export function renderPickleballCourtSvg(options: CourtSvgOptions = {}): string {
  const width = options.width ?? 520;
  const height = options.height ?? 280;
  const active = options.active ?? false;
  const kitchen = active ? COLORS.kitchenActive : COLORS.kitchen;
  const label = options.label ?? 'Pickleball court';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 280" width="${width}" height="${height}" role="img" aria-label="${label}">
  <rect x="8" y="8" width="504" height="264" rx="6" fill="${COLORS.surface}" stroke="${COLORS.surfaceBorder}" stroke-width="2"/>
  <rect x="16" y="16" width="488" height="248" fill="${COLORS.surface}"/>
  <rect x="196" y="16" width="64" height="248" fill="${kitchen}"/>
  <rect x="260" y="16" width="64" height="248" fill="${kitchen}"/>
  <line x1="16" y1="140" x2="196" y2="140" stroke="${COLORS.lines}" stroke-width="2"/>
  <line x1="324" y1="140" x2="504" y2="140" stroke="${COLORS.lines}" stroke-width="2"/>
  <line x1="196" y1="16" x2="196" y2="264" stroke="${COLORS.lines}" stroke-width="2"/>
  <line x1="324" y1="16" x2="324" y2="264" stroke="${COLORS.lines}" stroke-width="2"/>
  <rect x="16" y="16" width="488" height="248" fill="none" stroke="${COLORS.lines}" stroke-width="2"/>
  <line x1="260" y1="16" x2="260" y2="264" stroke="${COLORS.lines}" stroke-width="2.5"/>
  <rect x="254" y="16" width="12" height="248" fill="${COLORS.net}" opacity="0.85"/>
  <line x1="256" y1="16" x2="256" y2="264" stroke="${COLORS.lines}" stroke-width="1.5"/>
  <line x1="264" y1="16" x2="264" y2="264" stroke="${COLORS.lines}" stroke-width="1.5"/>
  <circle cx="260" cy="16" r="4" fill="${COLORS.net}" stroke="${COLORS.lines}" stroke-width="1"/>
  <circle cx="260" cy="264" r="4" fill="${COLORS.net}" stroke="${COLORS.lines}" stroke-width="1"/>
</svg>`;
}

export function mountPickleballCourt(
  container: HTMLElement,
  options: CourtSvgOptions = {}
): void {
  container.innerHTML = renderPickleballCourtSvg(options);
}
