import { el } from '@/lib/dom-utils';

export interface PlayerPauseDialogOptions {
  playerName: string;
  onSelectDuration: (durationMs: number) => void;
  onCancel?: () => void;
}

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

/** Choose how long a player stays on break from matchmaking. */
export function openPlayerPauseDialog(options: PlayerPauseDialogOptions): void {
  const { playerName, onSelectDuration, onCancel } = options;
  const dialog = el('dialog', { className: 'queue-dialog queue-dialog--pause' }) as HTMLDialogElement;
  const form = el('form', { className: 'queue-dialog__form', method: 'dialog' });

  const title = el('h2', { className: 'queue-dialog__title' }, ['Take a break']);
  const prompt = el('p', { className: 'queue-dialog__prompt' }, [
    el('strong', {}, [playerName]),
    ' will stay checked in but won\'t appear in Available Players until the break ends or you return them manually.',
  ]);

  const choices = el('div', { className: 'queue-dialog__action-choices queue-dialog__action-choices--pause' });

  const makeChoice = (label: string, hint: string, durationMs: number): HTMLButtonElement => {
    const btn = el('button', {
      type: 'button',
      className: 'queue-dialog__action-choice queue-dialog__action-choice--pause',
    }) as HTMLButtonElement;
    btn.append(
      el('span', { className: 'queue-dialog__action-choice-body' }, [
        el('span', { className: 'queue-dialog__action-choice-label' }, [label]),
        el('span', { className: 'queue-dialog__action-choice-hint' }, [hint]),
      ])
    );
    btn.addEventListener('click', () => {
      onSelectDuration(durationMs);
      dialog.close();
    });
    return btn;
  };

  choices.append(
    makeChoice('15 minutes', 'Quick rest between games', FIFTEEN_MINUTES_MS),
    makeChoice('30 minutes', 'Longer break', THIRTY_MINUTES_MS)
  );

  const actions = el('div', { className: 'queue-dialog__actions' });
  const cancelBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Cancel']);
  cancelBtn.addEventListener('click', () => {
    onCancel?.();
    dialog.close();
  });

  actions.append(cancelBtn);
  form.append(title, prompt, choices, actions);
  dialog.append(form);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
