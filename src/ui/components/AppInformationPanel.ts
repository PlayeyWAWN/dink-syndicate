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
      'Check in at least four players and choose Win/Lose Stack in Settings. Players split evenly into Winners and Losers piles at session start. After each game, record the winner — players route to the back of their pile and Next-Up alternates between piles. Partners shuffle each game. In manual mode (Auto-rotation off), tap players in the Next-Up pile to pick the lineup and use arrows to reorder before Start next game.',
  },
  {
    question: 'How does Ladder/Waterfall work?',
    answer:
      'Use at least two courts and check in players (seeded by DUPR onto Court 1 first). Record winners after each doubles game — winners move up one court, losers move down, and partners split on the next lineup. Extra players wait in the pool until a bench slot opens; the pool is ordered by fewest games played, with an Up next badge on the next four due in.',
  },
  {
    question: 'What is Auto-rotation?',
    answer:
      'In Win/Lose Stack and Ladder/Waterfall modes, Auto-rotation is off by default. Tap Auto-rotation on the Queue tab when you want the app to handle everything: routing players after each game, filling benches from the waiting pool (fewest games played first), and starting courts when four players are ready. Turn it off again to pick lineups manually — in Win/Lose Stack, tap players in the Next-Up pile and reorder before Start next game.',
  },
  {
    question: 'How do I end a Win/Lose Stack or Ladder session?',
    answer:
      'Turn off Auto-rotation on the Queue tab if it is on, so new games are not dealt automatically. Finish or cancel any active matches, then go to Settings → End session & archive. Only completed games count toward session stats and rankings — active matches cleared at end do not affect points.',
  },
  {
    question: 'Can I build matches manually?',
    answer:
      'Yes, in DUPR Open Play mode. Tap available players in the queue list to select them (2 for singles, 4 for doubles), then tap Build manual match. You can swap or replace players on queued matches by tapping their names.',
  },
  {
    question: 'What is Synergy Team?',
    answer:
      'In DUPR Open Play doubles, open the Players tab and turn on Synergy Team. Tap Synergy to create locked partner pairs using player dropdowns (up to six teams). When Synergy Team is on, Find Match always puts both partners in the same game when both are available, keeps them on the same team, and blocks queue edits that would split them. Mixed doubles pairs must be one male and one female; same-gender mode requires both players to share a gender. Turn Synergy Team off to use normal DUPR pairing rules while keeping your saved teams.',
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
