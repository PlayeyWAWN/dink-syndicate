import { createId } from '@/modules/matchmaking/create-id';
import { el } from '@/lib/dom-utils';
import { isAppOwner } from '@/modules/auth/isAppOwner';
import { sponsorConfigService } from '@/modules/live/SponsorConfigService';
import {
  uploadSponsorLogo,
  deleteSponsorLogoByUrl,
  isManagedSponsorLogoUrl,
} from '@/modules/live/SponsorUploadService';
import { slugifySponsorName } from '@/modules/live/sponsor-slug';
import { useSessionStore } from '@/stores/sessionStore';
import { SponsorConfig, SponsorEntry } from '@/types/live';

const MAX_SPONSORS = 18;

function normalizeLinkUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function truncateLinkMeta(linkUrl: string | undefined): string {
  const trimmed = linkUrl?.trim();
  if (!trimmed) return 'No link';
  return trimmed.length <= 48 ? trimmed : `${trimmed.slice(0, 47)}…`;
}

export function renderSponsorSettingsPanel(): HTMLElement | null {
  const session = useSessionStore.getState().session;
  if (!isAppOwner(session)) return null;

  const section = el('section', { className: 'sponsor-settings card' });
  section.append(
    el('h3', { className: 'stats-section__title' }, ['Sponsor logos']),
    el('p', { className: 'stats-section__lead' }, [
      'Up to 18 sponsors (6 per row, 3 rows max) on the live wallboard. Link URL is optional.',
    ])
  );

  let config: SponsorConfig = { sponsorsEnabled: false, sponsors: [], updatedAt: 0 };
  let lastRenderedSnapshot = '';
  let editingId: string | null = null;
  let pendingLogoFile: File | null = null;

  const enabledToggle = el('input', { type: 'checkbox', id: 'sponsors-enabled' }) as HTMLInputElement;
  const enabledLabel = el('label', { className: 'sponsor-settings__toggle', for: 'sponsors-enabled' }, [
    enabledToggle,
    el('span', {}, [' Show sponsors on Live Wallboard']),
  ]);

  const statsLine = el('p', { className: 'sponsor-settings__stats' }, ['0 sponsors']);
  const list = el('div', { className: 'sponsor-settings__list' });
  const addBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-small' }, [
    '+ Add sponsor',
  ]);
  const preview = el('div', { className: 'sponsor-settings__preview' });
  const statusLine = el('p', { className: 'sponsor-settings__status' }, ['']);

  const dialog = el('dialog', {
    className: 'sponsor-settings__dialog queue-dialog',
  }) as HTMLDialogElement;
  const dialogTitle = el('h2', { className: 'queue-dialog__title' }, ['Add sponsor']);
  const nameInput = el('input', {
    type: 'text',
    className: 'settings-input',
    placeholder: 'Sponsor name',
    maxlength: '80',
  }) as HTMLInputElement;
  const linkInput = el('input', {
    type: 'text',
    className: 'settings-input',
    placeholder: 'Link URL (optional)',
    maxlength: '500',
  }) as HTMLInputElement;
  const fileInput = el('input', { type: 'file', accept: 'image/*' }) as HTMLInputElement;
  const logoPreview = el('img', {
    className: 'sponsor-settings__dialog-preview',
    alt: '',
    hidden: 'true',
  }) as HTMLImageElement;
  const uploadStatus = el('span', { className: 'sponsor-settings__upload-status' }, ['']);
  const dialogError = el('p', { className: 'sponsor-settings__dialog-error' }, ['']);

  const cancelBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Cancel']);
  const saveDialogBtn = el('button', { type: 'button', className: 'btn btn-primary' }, ['Save sponsor']);

  const dialogActions = el('div', { className: 'queue-dialog__actions' });
  dialogActions.append(cancelBtn, saveDialogBtn);

  const chooseFileBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-small' }, [
    'Choose image',
  ]);
  chooseFileBtn.addEventListener('click', () => fileInput.click());

  const dialogForm = el('div', { className: 'queue-dialog__form sponsor-settings__dialog-form' });
  dialogForm.append(
    dialogTitle,
    el('label', { className: 'sponsor-settings__field-label' }, ['Sponsor name']),
    nameInput,
    el('label', { className: 'sponsor-settings__field-label' }, ['Logo']),
    logoPreview,
    el('div', { className: 'sponsor-settings__file-row' }, [chooseFileBtn, fileInput, uploadStatus]),
    el('label', { className: 'sponsor-settings__field-label' }, ['Sponsor link (optional)']),
    linkInput,
    dialogError,
    dialogActions
  );
  dialog.append(dialogForm);
  fileInput.hidden = true;

  const renderPreview = (): void => {
    preview.replaceChildren(el('p', { className: 'sponsor-settings__preview-label' }, ['Preview grid']));
    const grid = el('div', { className: 'sponsor-settings__grid' });
    const withLogos = config.sponsors.filter((sponsor) => sponsor.logoUrl);

    if (withLogos.length === 0) {
      grid.append(el('p', { className: 'sponsor-settings__preview-empty' }, ['No sponsor logos yet.']));
    } else {
      for (const sponsor of withLogos) {
        const item = el('div', { className: 'sponsor-settings__grid-item' });
        item.append(
          el('img', {
            src: sponsor.logoUrl,
            alt: sponsor.name || 'Sponsor logo',
            className: 'sponsor-settings__preview-logo',
          })
        );
        grid.append(item);
      }
    }

    preview.append(grid);
    preview.hidden = withLogos.length === 0;
  };

  const saveConfig = async (): Promise<void> => {
    await sponsorConfigService.save({
      ...config,
      sponsors: sponsorConfigService.normalizeSponsors(config.sponsors),
    });
  };

  const deleteLogoFromStorage = async (logoUrl: string): Promise<void> => {
    if (!logoUrl.trim()) return;
    if (!isManagedSponsorLogoUrl(logoUrl)) return;
    const deleted = await deleteSponsorLogoByUrl(logoUrl);
    if (!deleted) {
      throw new Error('Could not delete the logo from Firebase Storage.');
    }
  };

  const removeSponsorAtIndex = async (index: number, logoUrl?: string): Promise<void> => {
    const entry = config.sponsors[index];
    if (!entry) return;
    const url = logoUrl?.trim() || entry.logoUrl;
    await deleteLogoFromStorage(url);
    config.sponsors.splice(index, 1);
    await saveConfig();
    renderList();
  };

  const sponsorSnapshotKey = (cfg: SponsorConfig): string =>
    JSON.stringify({
      enabled: cfg.sponsorsEnabled,
      sponsors: cfg.sponsors.map((s) => ({
        id: s.id,
        name: s.name,
        logoUrl: s.logoUrl,
        linkUrl: s.linkUrl,
      })),
    });

  const findSponsorIndex = (id: string): number =>
    config.sponsors.findIndex((sponsor) => sponsor.id === id);

  const resetDialogForm = (): void => {
    editingId = null;
    pendingLogoFile = null;
    nameInput.value = '';
    linkInput.value = '';
    fileInput.value = '';
    logoPreview.hidden = true;
    logoPreview.removeAttribute('src');
    uploadStatus.textContent = '';
    dialogError.textContent = '';
    dialogTitle.textContent = 'Add sponsor';
  };

  const openDialog = (sponsorId: string | null): void => {
    resetDialogForm();
    if (sponsorId) {
      const sponsor = config.sponsors.find((entry) => entry.id === sponsorId);
      if (!sponsor) return;
      editingId = sponsorId;
      dialogTitle.textContent = 'Edit sponsor';
      nameInput.value = sponsor.name;
      linkInput.value = sponsor.linkUrl ?? '';
      if (sponsor.logoUrl) {
        logoPreview.src = sponsor.logoUrl;
        logoPreview.hidden = false;
      }
    }
    dialog.showModal();
  };

  const closeDialog = (): void => {
    dialog.close();
    resetDialogForm();
  };

  cancelBtn.addEventListener('click', () => closeDialog());
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDialog();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    pendingLogoFile = file ?? null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        logoPreview.src = reader.result;
        logoPreview.hidden = false;
      }
    };
    reader.readAsDataURL(file);
  });

  saveDialogBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      dialogError.textContent = 'Sponsor name is required.';
      return;
    }

    const existingIndex = editingId ? findSponsorIndex(editingId) : -1;
    const existing = existingIndex >= 0 ? config.sponsors[existingIndex] : null;
    const previousLogo = existing?.logoUrl ?? '';

    try {
      saveDialogBtn.disabled = true;
      dialogError.textContent = '';
      uploadStatus.textContent = pendingLogoFile ? 'Uploading…' : '';

      let logoUrl = existing?.logoUrl ?? '';
      if (pendingLogoFile) {
        const slugs = config.sponsors.map((s) => slugifySponsorName(s.name));
        logoUrl = await uploadSponsorLogo(pendingLogoFile, name, slugs);
        if (
          previousLogo &&
          previousLogo !== logoUrl &&
          isManagedSponsorLogoUrl(previousLogo)
        ) {
          await deleteLogoFromStorage(previousLogo);
        }
      }

      if (!logoUrl) {
        dialogError.textContent = 'Upload a logo image before saving.';
        return;
      }

      const entry: SponsorEntry = {
        id: editingId ?? createId('sponsor'),
        name,
        logoUrl,
        linkUrl: normalizeLinkUrl(linkInput.value),
        sortOrder: existing?.sortOrder ?? config.sponsors.length,
      };

      if (existingIndex >= 0) {
        config.sponsors[existingIndex] = entry;
      } else {
        config.sponsors.push(entry);
      }

      await saveConfig();
      closeDialog();
      renderList();
    } catch (error) {
      dialogError.textContent = error instanceof Error ? error.message : 'Save failed';
    } finally {
      saveDialogBtn.disabled = false;
      uploadStatus.textContent = '';
    }
  });

  const renderList = (): void => {
    const sponsors = [...config.sponsors].sort((a, b) => a.sortOrder - b.sortOrder);
    statsLine.textContent = `${sponsors.length} sponsor${sponsors.length === 1 ? '' : 's'}`;
    addBtn.hidden = sponsors.length >= MAX_SPONSORS;
    list.replaceChildren();

    if (sponsors.length === 0) {
      list.append(
        el('p', { className: 'sponsor-settings__empty' }, [
          'No sponsors yet. Tap ',
          el('strong', {}, ['+ Add sponsor']),
          ' to upload a logo.',
        ])
      );
    } else {
      for (const sponsor of sponsors) {
        const index = findSponsorIndex(sponsor.id);
        const row = el('div', { className: 'sponsor-settings__row' });

        if (sponsor.logoUrl) {
          row.append(
            el('img', {
              className: 'sponsor-settings__row-thumb',
              src: sponsor.logoUrl,
              alt: '',
            })
          );
        } else {
          row.append(el('div', { className: 'sponsor-settings__row-thumb is-empty' }));
        }

        const info = el('div', { className: 'sponsor-settings__row-info' });
        info.append(
          el('div', { className: 'sponsor-settings__row-name' }, [sponsor.name || 'Unnamed sponsor']),
          el('div', { className: 'sponsor-settings__row-meta' }, [truncateLinkMeta(sponsor.linkUrl)])
        );

        const actions = el('div', { className: 'sponsor-settings__row-actions' });
        const editBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-small' }, [
          'Edit',
        ]);
        const deleteBtn = el('button', {
          type: 'button',
          className: 'btn btn-secondary btn-small sponsor-settings__delete-btn',
        }, ['Delete']);

        editBtn.addEventListener('click', () => openDialog(sponsor.id));
        deleteBtn.addEventListener('click', async () => {
          const label = sponsor.name.trim() || 'this sponsor';
          if (!confirm(`Remove ${label}? This deletes the logo from Firebase Storage.`)) return;
          try {
            deleteBtn.disabled = true;
            await removeSponsorAtIndex(index, sponsor.logoUrl);
          } catch (error) {
            alert(error instanceof Error ? error.message : 'Delete failed');
            deleteBtn.disabled = false;
          }
        });

        actions.append(editBtn, deleteBtn);
        row.append(info, actions);
        list.append(row);
      }
    }

    renderPreview();
  };

  enabledToggle.addEventListener('change', async () => {
    config.sponsorsEnabled = enabledToggle.checked;
    try {
      await saveConfig();
      statusLine.textContent = 'Saved.';
    } catch (error) {
      statusLine.textContent = error instanceof Error ? error.message : 'Save failed';
    }
  });

  addBtn.addEventListener('click', () => {
    if (config.sponsors.length >= MAX_SPONSORS) return;
    openDialog(null);
  });

  const unsub = sponsorConfigService.subscribe((next) => {
    const localOnly = config.sponsors.filter(
      (s) => !next.sponsors.some((remote) => remote.id === s.id)
    );
    config = { ...next, sponsors: [...next.sponsors, ...localOnly] };
    enabledToggle.checked = config.sponsorsEnabled;
    const snapshot = sponsorSnapshotKey(config);
    if (snapshot !== lastRenderedSnapshot) {
      lastRenderedSnapshot = snapshot;
      renderList();
    } else {
      renderPreview();
    }
  });

  section.append(enabledLabel, statsLine, addBtn, list, preview, statusLine, dialog);
  section.addEventListener('DOMNodeRemovedFromDocument', () => unsub());

  return section;
}
