import { el } from '@/lib/dom-utils';
import { formatDuprRating } from '@/lib/format-utils';
import { BalanceAssessment } from '@/modules/queue/ManualMatchService';

export interface BalanceNoticeDialogOptions {
  assessment: BalanceAssessment;
  onConfirm: () => void;
  onCancel?: () => void;
}

/** Confirm manual match creation with balanced / unbalanced notice. */
export function openBalanceNoticeDialog(options: BalanceNoticeDialogOptions): void {
  const { assessment, onConfirm, onCancel } = options;
  const dialog = el('dialog', { className: 'queue-dialog queue-dialog--balance' }) as HTMLDialogElement;
  const form = el('form', { className: 'queue-dialog__form', method: 'dialog' });

  const title = el(
    'h2',
    { className: 'queue-dialog__title' },
    [assessment.balanced ? 'Skill-balanced match' : 'Unbalanced match']
  );

  const status = el('p', {
    className: `queue-dialog__status queue-dialog__status--${assessment.balanced ? 'ok' : 'warn'}`,
  }, [assessment.summary]);

  const detail = el('p', { className: 'queue-dialog__detail' }, [
    `Team 1 avg DUPR ${formatDuprRating(assessment.team1Avg)} · Team 2 avg DUPR ${formatDuprRating(assessment.team2Avg)}`,
  ]);

  const hint = el('p', { className: 'queue-dialog__hint' }, [
    assessment.balanced
      ? 'This lineup passes DUPR balance rules. Queue it when ready.'
      : 'This lineup exceeds DUPR balance limits. You can still queue it if you want.',
  ]);

  const actions = el('div', { className: 'queue-dialog__actions' });
  const cancelBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Cancel']);
  const confirmBtn = el('button', {
    type: 'submit',
    className: `btn ${assessment.balanced ? 'btn-success' : 'btn-secondary'}`,
  }, ['Queue match']);

  cancelBtn.addEventListener('click', () => {
    onCancel?.();
    dialog.close();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onConfirm();
    dialog.close();
  });

  actions.append(cancelBtn, confirmBtn);
  form.append(title, status, detail, hint, actions);
  dialog.append(form);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
