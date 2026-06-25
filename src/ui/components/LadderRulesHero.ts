import { el } from '@/lib/dom-utils';
import { mountAppIcon } from '@/ui/icons/app-icons';
import { renderRotationControls } from '@/ui/components/RotationControlsPanel';

export interface LadderRulesHeroOptions {
  onNavigate: () => void;
}

/** Visual rules strip: winners up, losers down, plus rotation controls. */
export function renderLadderRulesHero(options: LadderRulesHeroOptions): HTMLElement {
  const { onNavigate } = options;
  const hero = el('div', { className: 'ladder-hero' });

  const rules = el('div', { className: 'ladder-hero__rules' });

  const winnersCol = el('div', { className: 'ladder-hero__rule ladder-hero__rule--win' });
  const winnersIcon = el('div', { className: 'ladder-hero__rule-icon', 'aria-hidden': 'true' });
  mountAppIcon(winnersIcon, 'user-male');
  winnersCol.append(
    winnersIcon,
    el('span', { className: 'ladder-hero__rule-arrow', 'aria-hidden': 'true' }, ['↑']),
    el('strong', { className: 'ladder-hero__rule-title' }, ['Winners move up'])
  );

  const losersCol = el('div', { className: 'ladder-hero__rule ladder-hero__rule--lose' });
  const losersIcon = el('div', { className: 'ladder-hero__rule-icon', 'aria-hidden': 'true' });
  mountAppIcon(losersIcon, 'user-female');
  losersCol.append(
    losersIcon,
    el('span', { className: 'ladder-hero__rule-arrow', 'aria-hidden': 'true' }, ['↓']),
    el('strong', { className: 'ladder-hero__rule-title' }, ['Losers move down'])
  );

  rules.append(winnersCol, losersCol);
  hero.append(rules);

  const rotationWrap = el('div', { className: 'ladder-hero__rotation' });
  rotationWrap.append(renderRotationControls({ onNavigate, mode: 'ladder' }));
  hero.append(rotationWrap);

  return hero;
}
