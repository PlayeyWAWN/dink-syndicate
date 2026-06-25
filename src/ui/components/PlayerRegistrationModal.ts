import { el } from '@/lib/dom-utils';
import { clampDuprRating, formatDuprRating } from '@/lib/format-utils';
import { formatSkillLevel, getSkillLevelFromDupr, skillLevelBadgeClass } from '@/lib/skill-utils';
import { renderDuprHelpPanel } from '@/ui/components/DuprHelpPanel';
import { createAppIcon, genderAppIconId } from '@/ui/icons/app-icons';
import type { Player, PlayerGender } from '@/types/player';

export interface PlayerRegistrationModalOptions {
  mode: 'add' | 'edit';
  player?: Player;
  onSubmit: (data: {
    name: string;
    names?: string[];
    gender: PlayerGender;
    duprRating: number;
    isBulk: boolean;
  }) => void;
  onClose: () => void;
}

function renderGenderPicker(
  selected: PlayerGender,
  onChange: (gender: PlayerGender) => void
): HTMLElement {
  const group = el('div', { className: 'reg-gender-picker', role: 'radiogroup', 'aria-label': 'Gender' });

  const setSelected = (gender: PlayerGender) => {
    onChange(gender);
    group.querySelectorAll<HTMLButtonElement>('.reg-gender-picker__btn').forEach((btn) => {
      const active = btn.dataset.gender === gender;
      btn.classList.toggle('reg-gender-picker__btn--active', active);
    });
  };

  for (const gender of ['male', 'female'] as const) {
    const label = gender === 'male' ? 'Male' : 'Female';
    const btn = el(
      'button',
      {
        type: 'button',
        className: `reg-gender-picker__btn reg-gender-picker__btn--${gender}${gender === selected ? ' reg-gender-picker__btn--active' : ''}`,
        'data-gender': gender,
      },
      []
    );
    btn.append(createAppIcon(genderAppIconId(gender)), document.createTextNode(` ${label.toUpperCase()}`));
    btn.addEventListener('click', () => setSelected(gender));
    group.append(btn);
  }

  return group;
}

function renderSkillPreview(ratingInput: HTMLInputElement): HTMLElement {
  const preview = el('div', { className: 'reg-skill-preview' });
  const update = () => {
    const rating = clampDuprRating(parseFloat(ratingInput.value) || 0);
    const level = getSkillLevelFromDupr(rating);
    preview.replaceChildren();
    preview.append(
      el('span', { className: skillLevelBadgeClass(level) }, [formatSkillLevel(level)]),
      el('span', { className: 'reg-skill-preview__rating' }, [`DUPR ${formatDuprRating(rating)}`])
    );
  };
  ratingInput.addEventListener('input', update);
  ratingInput.addEventListener('blur', () => {
    ratingInput.value = formatDuprRating(parseFloat(ratingInput.value) || 0);
    update();
  });
  update();
  return preview;
}

export function openPlayerRegistrationModal(options: PlayerRegistrationModalOptions): void {
  const isEdit = options.mode === 'edit';
  let selectedGender: PlayerGender = options.player?.gender ?? 'male';
  let isBulk = false;

  const dialog = el('dialog', { className: 'player-reg-modal' }) as HTMLDialogElement;
  const form = el('form', { className: 'player-reg-modal__form' });

  const title = el('h2', { className: 'player-reg-modal__title' }, [
    isEdit ? 'Edit Player' : 'Player Registration',
  ]);

  const modeTabs = el('div', { className: 'player-reg-modal__tabs' });
  const singleTab = el('button', {
    type: 'button',
    className: 'player-reg-modal__tab player-reg-modal__tab--active',
    'data-mode': 'single',
  }, ['Single Player']);
  const bulkTab = el('button', {
    type: 'button',
    className: 'player-reg-modal__tab',
    'data-mode': 'bulk',
  }, ['Bulk Add']);

  if (isEdit) {
    modeTabs.style.display = 'none';
  } else {
    modeTabs.append(singleTab, bulkTab);
  }

  const nameArea = el('div', { className: 'player-reg-modal__name-area' });

  const singlePanel = el('div', { className: 'player-reg-panel' });
  singlePanel.append(
    el('label', { className: 'player-reg-modal__label', for: 'reg-player-name' }, ['Name']),
    el('input', {
      id: 'reg-player-name',
      type: 'text',
      className: 'player-reg-modal__input',
      placeholder: 'Enter player name',
      value: options.player?.name ?? '',
    })
  );

  const bulkPanel = el('div', { className: 'player-reg-panel', hidden: 'true' });
  bulkPanel.append(
    el('label', { className: 'player-reg-modal__label', for: 'reg-bulk-names' }, [
      'Names (one per line)',
    ]),
    el('textarea', {
      id: 'reg-bulk-names',
      className: 'player-reg-modal__textarea',
      rows: '6',
      placeholder: 'Enter player names (one per line)\nExample:\nJohn Smith\nJane Doe',
    })
  );

  nameArea.append(singlePanel, bulkPanel);

  const genderField = el('div', { className: 'player-reg-modal__field' });
  genderField.append(
    el('span', { className: 'player-reg-modal__label' }, ['Select Gender']),
    renderGenderPicker(selectedGender, (gender) => {
      selectedGender = gender;
    })
  );

  const defaultRating = formatDuprRating(options.player?.dupr.duprDoublesRating ?? 3.5);
  const ratingField = el('div', { className: 'player-reg-modal__field' });
  const ratingInput = el('input', {
    id: 'reg-dupr-rating',
    type: 'number',
    className: 'player-reg-modal__input',
    min: '0',
    max: '8',
    step: '0.01',
    value: defaultRating,
    'aria-label': 'DUPR rating',
  }) as HTMLInputElement;

  ratingField.append(
    el('label', { className: 'player-reg-modal__label', for: 'reg-dupr-rating' }, [
      'DUPR Rating',
    ]),
    ratingInput,
    renderSkillPreview(ratingInput),
    renderDuprHelpPanel({ id: 'reg-dupr-help' })
  );

  const actions = el('div', { className: 'player-reg-modal__actions' });
  const cancelBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Cancel']);
  const submitBtn = el('button', { type: 'submit', className: 'btn' }, [
    isEdit ? 'Save Changes' : 'Add Player',
  ]) as HTMLButtonElement;

  const setMode = (bulk: boolean) => {
    isBulk = bulk;
    singleTab.classList.toggle('player-reg-modal__tab--active', !bulk);
    bulkTab.classList.toggle('player-reg-modal__tab--active', bulk);
    singlePanel.hidden = bulk;
    bulkPanel.hidden = !bulk;
    submitBtn.textContent = bulk ? 'Add Players' : isEdit ? 'Save Changes' : 'Add Player';
  };

  singleTab.addEventListener('click', () => setMode(false));
  bulkTab.addEventListener('click', () => setMode(true));
  setMode(false);

  cancelBtn.addEventListener('click', () => {
    dialog.close();
    dialog.remove();
    options.onClose();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const rating = clampDuprRating(parseFloat(ratingInput.value) || 0);
    ratingInput.value = formatDuprRating(rating);

    if (isBulk && !isEdit) {
      const textarea = bulkPanel.querySelector('#reg-bulk-names') as HTMLTextAreaElement;
      const names = textarea.value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      if (names.length === 0) {
        alert('Enter at least one player name.');
        return;
      }
      options.onSubmit({ name: '', names, gender: selectedGender, duprRating: rating, isBulk: true });
    } else {
      const nameInput = singlePanel.querySelector('#reg-player-name') as HTMLInputElement;
      if (!nameInput.value.trim()) {
        alert('Enter a player name.');
        return;
      }
      options.onSubmit({
        name: nameInput.value.trim(),
        gender: selectedGender,
        duprRating: rating,
        isBulk: false,
      });
    }

    dialog.close();
    dialog.remove();
  });

  actions.append(cancelBtn, submitBtn);
  form.append(title, modeTabs, nameArea, genderField, ratingField, actions);
  dialog.append(form);
  document.body.append(dialog);
  dialog.showModal();
}
