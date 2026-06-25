import { el } from '@/lib/dom-utils';
import { courtService, MAX_COURTS } from '@/modules/courts/CourtService';
import { useCourtStore } from '@/stores/courtStore';
import { useQueueStore } from '@/stores/queueStore';
import { appRouter } from '@/app/router';
import { renderCourtView } from '@/ui/components/CourtView';

function openAddCourtDialog(onAdd: (label: string) => void): void {
  const courts = useCourtStore.getState().courts;
  const defaultLabel = courtService.defaultLabelForNewCourt(courts);

  const dialog = el('dialog', { className: 'court-add-modal' }) as HTMLDialogElement;
  const form = el('form', { className: 'court-add-modal__form', method: 'dialog' });

  const title = el('h2', { className: 'court-add-modal__title' }, ['Add court']);
  const label = el('label', { className: 'court-add-modal__label', for: 'court-add-name' }, [
    'Court name',
  ]);
  const input = el('input', {
    id: 'court-add-name',
    type: 'text',
    className: 'court-add-modal__input',
    value: defaultLabel,
    maxlength: '32',
    'aria-label': 'Court name',
    autocomplete: 'off',
  }) as HTMLInputElement;

  const actions = el('div', { className: 'court-add-modal__actions' });
  const cancelBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Cancel']);
  const addBtn = el('button', { type: 'submit', className: 'btn' }, ['Add court']);

  cancelBtn.addEventListener('click', () => dialog.close());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onAdd(input.value.trim() || defaultLabel);
    dialog.close();
  });

  actions.append(cancelBtn, addBtn);
  form.append(title, label, input, actions);
  dialog.append(form);

  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  input.focus();
  input.select();
}

export function renderCourtsScreen(container: HTMLElement): void {
  const courts = useCourtStore.getState().courts;
  const { queueState } = useQueueStore.getState();
  const canAddCourt = courts.length < MAX_COURTS;

  const header = el('div', { className: 'section-header' });
  header.append(el('div', { className: 'section-title' }, ['Courts']));

  const addBtn = el(
    'button',
    {
      type: 'button',
      className: 'btn btn-success',
      disabled: canAddCourt ? undefined : 'true',
    },
    ['Add Court']
  );
  addBtn.addEventListener('click', () => {
    openAddCourtDialog((label) => {
      useCourtStore.getState().addCourt(label);
      appRouter.navigate('courts');
    });
  });
  header.append(addBtn);

  container.append(
    header,
    el('p', { className: 'screen-lead' }, [
      `${courts.filter((c) => !c.activeMatchId).length} open · ${queueState.activeMatches.length} in progress`,
    ])
  );

  if (courts.length === 0) {
    container.append(
      el('p', { className: 'empty-state' }, ['No courts yet. Tap Add Court to create one.'])
    );
    return;
  }

  const grid = el('div', { className: 'court-grid' });
  for (const court of courts) {
    grid.append(
      renderCourtView({
        court,
        inUse: Boolean(court.activeMatchId),
        onRename: (courtId, label) => {
          useCourtStore.getState().renameCourt(courtId, label);
          appRouter.navigate('courts');
        },
        onDelete: (courtId) => {
          const target = courts.find((c) => c.id === courtId);
          if (!target) return;

          const message = target.activeMatchId
            ? `Court "${target.label}" has an active match.\n\nDelete this court and return the match to the queue?`
            : `Delete court "${target.label}"?`;
          if (!window.confirm(message)) return;

          if (target.activeMatchId) {
            useQueueStore.getState().cancelActiveMatch(target.activeMatchId);
          }
          useCourtStore.getState().removeCourt(courtId);
          appRouter.navigate('courts');
        },
      })
    );
  }

  container.append(grid);
}
