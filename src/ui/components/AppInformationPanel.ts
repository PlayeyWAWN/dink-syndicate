import {
  APP_NAME,
  APP_TAGLINE,
  DEVELOPER_FACEBOOK_URL,
} from '@/config/constants';
import { el } from '@/lib/dom-utils';
import { getRuntimeAppVersion } from '@/lib/version-check';
import { useSettingsUiStore } from '@/stores/settingsUiStore';
import { renderSettingsCollapsibleSection } from '@/ui/components/SettingsCollapsibleSection';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'How do I run a club session?',
    answer:
      'Add players on the Players tab (name, gender, DUPR rating), check them in, and set your court count on the Courts tab. Choose a Game mode in Settings (DUPR Open Play, Win/Lose Stack, or Ladder/Waterfall), then open Queue to run matches.',
  },
  {
    question: 'What are the game modes?',
    answer:
      'DUPR Open Play uses fairness-ranked Find Match plus manual lineups. Win/Lose Stack keeps separate Winners and Losers waiting piles with alternating Next-Up and partner shuffle. Ladder/Waterfall treats Court 1 as the top rung — winners move up and losers move down after each game.',
  },
  {
    question: 'How does Find Match work?',
    answer:
      'In DUPR Open Play mode, choose court format (singles or doubles) and match mode (Balanced, Mix 1M+1F, or Same Gender) on the Queue tab, then tap Create Match. The app prioritizes players with fewer games played, then balances skill using DUPR ratings.',
  },
  {
    question: 'How does Win/Lose Stack work?',
    answer:
      'Check in at least four players and switch to Win/Lose Stack in Settings. Record winners on active matches — players auto-route to the Winners or Losers pile, and the next game starts when the Next-Up pile has four players. Partners shuffle each game.',
  },
  {
    question: 'How does Ladder/Waterfall work?',
    answer:
      'Use at least two courts and check in players (seeded by DUPR onto Court 1 first). Record winners after each doubles game — winners move up one court, losers move down, and partners split on the next lineup. Extra players wait in the pool until a bench has four.',
  },
  {
    question: 'How do I end a Win/Lose Stack or Ladder session?',
    answer:
      'On the Queue tab, tap Stop rotation so new games are not dealt automatically. Finish or cancel any active matches, then go to Settings → End session & archive. Only completed games count toward session stats and rankings — active matches cleared at end do not affect points.',
  },
  {
    question: 'Can I build matches manually?',
    answer:
      'Yes, in DUPR Open Play mode. Tap available players in the queue list to select them (2 for singles, 4 for doubles), then tap Build manual match. You can swap or replace players on queued matches by tapping their names.',
  },
  {
    question: 'What if all courts are occupied?',
    answer:
      'Queued matches wait until a court frees up. Tap PLAY on a queue entry — if every court is busy, you will see a message to finish an active match or add more courts. Record the winner on an active match to release that court.',
  },
  {
    question: 'How do I save or move my roster?',
    answer:
      'Use Roster & courts transfer in Settings to export or import player names, DUPR ratings, and court setup as JSON. Full session backup includes the queue and match history for moving an in-progress night to another device.',
  },
];

function renderFaqItem(item: FaqItem): HTMLElement {
  const details = el('details', { className: 'app-info-faq' });
  details.append(
    el('summary', { className: 'app-info-faq__summary' }, [item.question]),
    el('p', { className: 'app-info-faq__answer' }, [item.answer])
  );
  return details;
}

/** Version, easter egg, FAQ, and developer contact. */
export function renderAppInformationPanel(): HTMLElement {
  const settingsUi = useSettingsUiStore.getState();

  const versionRow = el('p', { className: 'app-info__version' });
  versionRow.append(
    el('strong', {}, ['Version']),
    document.createTextNode(` ${getRuntimeAppVersion()}`)
  );

  const easterEgg = el('p', { className: 'app-info__easter-egg' }, [
    `${APP_TAGLINE} is a playful nod to the app's creator, `,
    el('abbr', { title: 'Ball Engagement Network' }, ['B.E.N.']),
    '.',
  ]);

  const faqHeading = el('h4', { className: 'players-section-label' }, ['FAQ']);
  const faqList = el('div', { className: 'app-info-faq-list' });
  for (const item of FAQ_ITEMS) {
    faqList.append(renderFaqItem(item));
  }

  const contactHeading = el('h4', { className: 'players-section-label' }, ['Contact the developer']);
  const contactLead = el('p', { className: 'screen-lead' }, [
    `Questions, feedback, or bugs for ${APP_NAME}? Reach out on Facebook.`,
  ]);
  const contactLink = el(
    'a',
    {
      href: DEVELOPER_FACEBOOK_URL,
      target: '_blank',
      rel: 'noopener noreferrer',
      className: 'app-info__contact-link btn btn-secondary',
    },
    ['Message on Facebook']
  );

  return renderSettingsCollapsibleSection(
    [versionRow, easterEgg, faqHeading, faqList, contactHeading, contactLead, contactLink],
    {
      title: 'App information',
      open: settingsUi.appInfoSectionOpen,
      onToggle: (open) => useSettingsUiStore.getState().setAppInfoSectionOpen(open),
    }
  );
}
