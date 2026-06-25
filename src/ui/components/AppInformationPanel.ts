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
      'Add players on the Players tab (name, gender, DUPR rating), check them in, and set your court count on the Courts tab. Open Queue to create matches and send them to court when a slot opens.',
  },
  {
    question: 'How does Find Match work?',
    answer:
      'On the Queue tab, choose court format (singles or doubles) and match mode (Balanced, Mix 1M+1F, or Same Gender), then tap Create Match. The app prioritizes players with fewer games played, then balances skill using DUPR ratings.',
  },
  {
    question: 'Can I build matches manually?',
    answer:
      'Yes. Tap available players in the queue list to select them (2 for singles, 4 for doubles), then tap Build manual match. You can swap or replace players on queued matches by tapping their names.',
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
