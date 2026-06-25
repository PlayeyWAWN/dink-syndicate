import { el } from '@/lib/dom-utils';
import { mountPickleballCourt } from '@/modules/courts/pickleball-court';
import { Court } from '@/types/court';
import { mountAppIcon } from '@/ui/icons/app-icons';

export interface CourtViewOptions {
  court: Court;
  inUse: boolean;
  onRename: (courtId: string, label: string) => void;
  onDelete: (courtId: string) => void;
}

export function renderCourtView(options: CourtViewOptions): HTMLElement {
  const { court, inUse, onRename, onDelete } = options;
  const card = el('article', { className: 'court-card' });

  const header = el('div', { className: 'court-card__header' });

  const nameInput = el('input', {
    type: 'text',
    className: 'court-card__name-input',
    value: court.label,
    'aria-label': `Court name for ${court.label}`,
    maxlength: '32',
  }) as HTMLInputElement;

  const commitRename = (): void => {
    const next = nameInput.value.trim();
    if (next && next !== court.label) {
      onRename(court.id, next);
    } else if (!next) {
      nameInput.value = court.label;
    }
  };

  nameInput.addEventListener('change', commitRename);
  nameInput.addEventListener('blur', commitRename);
  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      nameInput.blur();
    }
  });

  const deleteBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm court-card__delete-btn',
    title: 'Delete court',
    'aria-label': `Delete court ${court.label}`,
  });
  mountAppIcon(deleteBtn, 'delete');
  deleteBtn.addEventListener('click', () => onDelete(court.id));

  header.append(nameInput, deleteBtn);

  const svgWrap = el('div', { className: 'court-card__svg' });
  mountPickleballCourt(svgWrap, {
    active: inUse,
    label: court.label,
    width: 240,
    height: 130,
  });

  const status = el('p', {
    className: inUse ? 'court-card__status court-card__status--busy' : 'court-card__status court-card__status--open',
  }, [inUse ? 'In use — see Queue tab' : 'Open']);

  card.append(header, svgWrap, status);
  return card;
}
