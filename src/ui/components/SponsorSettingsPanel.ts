import { createId } from '@/modules/matchmaking/create-id';
import { el } from '@/lib/dom-utils';
import { isAppOwner } from '@/modules/auth/isAppOwner';
import { sponsorConfigService } from '@/modules/live/SponsorConfigService';
import { uploadSponsorLogo, deleteSponsorLogoByUrl, isManagedSponsorLogoUrl } from '@/modules/live/SponsorUploadService';
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

  const enabledToggle = el('input', { type: 'checkbox', id: 'sponsors-enabled' }) as HTMLInputElement;
  const enabledLabel = el('label', { className: 'sponsor-settings__toggle', for: 'sponsors-enabled' }, [
    enabledToggle,
    el('span', {}, [' Show sponsors on Live Wallboard']),
  ]);

  const list = el('div', { className: 'sponsor-settings__list' });
  const preview = el('div', { className: 'sponsor-settings__preview' });
  const addBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Add sponsor']);

  const renderPreview = (): void => {
    preview.replaceChildren(el('p', { className: 'sponsor-settings__preview-label' }, ['Preview grid']));
    const grid = el('div', { className: 'sponsor-settings__grid' });

    if (config.sponsors.length === 0) {
      grid.append(el('p', { className: 'sponsor-settings__preview-empty' }, ['No sponsor logos yet.']));
    }

    for (const sponsor of config.sponsors) {
      if (!sponsor.logoUrl) continue;

      const index = config.sponsors.findIndex((s) => s.id === sponsor.id);
      const item = el('div', { className: 'sponsor-settings__grid-item' });
      item.append(
        el('img', {
          src: sponsor.logoUrl,
          alt: sponsor.name || 'Sponsor logo',
          className: 'sponsor-settings__preview-logo',
        })
      );

      const deleteLogoBtn = el(
        'button',
        {
          type: 'button',
          className: 'sponsor-settings__grid-delete btn btn-small btn-danger',
          title: 'Delete logo from Storage',
        },
        ['Delete']
      );
      deleteLogoBtn.addEventListener('click', async () => {
        const label = sponsor.name.trim() || 'this sponsor logo';
        if (!confirm(`Delete ${label}? This removes the sponsor and deletes the file from Storage.`)) return;
        try {
          deleteLogoBtn.disabled = true;
          await removeSponsorAtIndex(index, sponsor.logoUrl);
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Delete failed');
          deleteLogoBtn.disabled = false;
        }
      });

      item.append(deleteLogoBtn);
      grid.append(item);
    }

    preview.append(grid);
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

  const renderSponsorRow = (sponsor: SponsorEntry, index: number): void => {
    const row = el('div', { className: 'sponsor-settings__row' });

    const nameInput = el('input', {
      type: 'text',
      className: 'settings-input',
      value: sponsor.name,
      placeholder: 'Sponsor name',
    }) as HTMLInputElement;

    const urlInput = el('input', {
      type: 'url',
      className: 'settings-input',
      value: sponsor.logoUrl,
      placeholder: 'Logo URL (optional if uploaded)',
    }) as HTMLInputElement;

    const linkInput = el('input', {
      type: 'text',
      className: 'settings-input',
      value: sponsor.linkUrl ?? '',
      placeholder: 'Link URL (optional)',
    }) as HTMLInputElement;

    const fileInput = el('input', { type: 'file', accept: 'image/*' }) as HTMLInputElement;
    const uploadStatus = el('span', { className: 'sponsor-settings__upload-status' }, ['']);

    const saveRow = el('button', { type: 'button', className: 'btn btn-small' }, ['Save']);
    const removeRow = el('button', { type: 'button', className: 'btn btn-small btn-danger' }, ['Remove sponsor']);
    const deleteLogoBtn = el(
      'button',
      { type: 'button', className: 'btn btn-small btn-danger sponsor-settings__delete-logo' },
      ['Delete logo']
    );
    deleteLogoBtn.hidden = !sponsor.logoUrl;

    const resolveLogoUrl = (): string =>
      urlInput.value.trim() || config.sponsors[index]?.logoUrl || sponsor.logoUrl;

    const syncDeleteLogoVisibility = (): void => {
      deleteLogoBtn.hidden = !resolveLogoUrl();
    };

    saveRow.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      const logoUrl = resolveLogoUrl();
      if (!name || !logoUrl) {
        alert('Sponsor name and logo are required. Enter a name and upload an image, or paste a logo URL.');
        return;
      }
      config.sponsors[index] = {
        ...sponsor,
        name,
        logoUrl,
        linkUrl: normalizeLinkUrl(linkInput.value),
      };
      try {
        saveRow.disabled = true;
        await saveConfig();
        renderPreview();
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Save failed');
      } finally {
        saveRow.disabled = false;
      }
    });

    removeRow.addEventListener('click', async () => {
      const label = nameInput.value.trim() || sponsor.name.trim() || 'this sponsor';
      if (!confirm(`Remove ${label}? This deletes the logo from Firebase Storage.`)) return;
      try {
        removeRow.disabled = true;
        deleteLogoBtn.disabled = true;
        await removeSponsorAtIndex(index, resolveLogoUrl());
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Remove failed');
      } finally {
        removeRow.disabled = false;
        deleteLogoBtn.disabled = false;
      }
    });

    deleteLogoBtn.addEventListener('click', async () => {
      const logoUrl = resolveLogoUrl();
      if (!logoUrl) return;
      const label = nameInput.value.trim() || sponsor.name.trim() || 'this logo';
      if (!confirm(`Delete ${label} from Storage? The sponsor entry will be removed.`)) return;
      try {
        deleteLogoBtn.disabled = true;
        removeRow.disabled = true;
        await removeSponsorAtIndex(index, logoUrl);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Delete failed');
      } finally {
        deleteLogoBtn.disabled = false;
        removeRow.disabled = false;
      }
    });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      const name = nameInput.value.trim();
      if (!file) return;
      if (!name) {
        alert('Enter sponsor name before uploading.');
        fileInput.value = '';
        return;
      }
      const previousLogo = resolveLogoUrl();
      try {
        uploadStatus.textContent = 'Uploading…';
        saveRow.disabled = true;
        deleteLogoBtn.disabled = true;
        const slugs = config.sponsors.map((s) => slugifySponsorName(s.name));
        const logoUrl = await uploadSponsorLogo(file, name, slugs);
        if (
          previousLogo &&
          previousLogo !== logoUrl &&
          isManagedSponsorLogoUrl(previousLogo)
        ) {
          await deleteLogoFromStorage(previousLogo);
        }
        urlInput.value = logoUrl;
        config.sponsors[index] = {
          ...sponsor,
          name,
          logoUrl,
          linkUrl: normalizeLinkUrl(linkInput.value),
        };
        syncDeleteLogoVisibility();
        uploadStatus.textContent = 'Uploaded';
        await saveConfig();
        renderPreview();
      } catch (error) {
        uploadStatus.textContent = '';
        alert(error instanceof Error ? error.message : 'Upload failed');
      } finally {
        saveRow.disabled = false;
        deleteLogoBtn.disabled = false;
        fileInput.value = '';
      }
    });

    urlInput.addEventListener('input', syncDeleteLogoVisibility);

    row.append(
      nameInput,
      urlInput,
      linkInput,
      fileInput,
      uploadStatus,
      saveRow,
      deleteLogoBtn,
      removeRow
    );
    list.append(row);
  };

  const renderList = (): void => {
    list.replaceChildren();
    config.sponsors.forEach((sponsor, index) => renderSponsorRow(sponsor, index));
    addBtn.hidden = config.sponsors.length >= MAX_SPONSORS;
    renderPreview();
  };

  enabledToggle.addEventListener('change', async () => {
    config.sponsorsEnabled = enabledToggle.checked;
    await saveConfig();
  });

  addBtn.addEventListener('click', () => {
    if (config.sponsors.length >= MAX_SPONSORS) return;
    config.sponsors.push({
      id: createId('sponsor'),
      name: '',
      logoUrl: '',
      sortOrder: config.sponsors.length,
    });
    renderList();
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

  section.append(enabledLabel, list, addBtn, preview);
  section.addEventListener('DOMNodeRemovedFromDocument', () => unsub());

  return section;
}
