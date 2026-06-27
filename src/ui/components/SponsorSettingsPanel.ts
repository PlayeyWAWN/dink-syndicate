import { createId } from '@/modules/matchmaking/create-id';
import { el } from '@/lib/dom-utils';
import { isAppOwner } from '@/modules/auth/isAppOwner';
import { sponsorConfigService } from '@/modules/live/SponsorConfigService';
import { uploadSponsorLogo, deleteSponsorLogoByUrl } from '@/modules/live/SponsorUploadService';
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
    for (const sponsor of config.sponsors) {
      const item = el('div', { className: 'sponsor-settings__grid-item' });
      item.append(
        el('img', { src: sponsor.logoUrl, alt: sponsor.name, className: 'sponsor-settings__preview-logo' })
      );
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
      value: sponsor.logoUrl.startsWith('http') ? sponsor.logoUrl : '',
      placeholder: 'Logo URL (optional if uploaded)',
    }) as HTMLInputElement;

    const linkInput = el('input', {
      type: 'url',
      className: 'settings-input',
      value: sponsor.linkUrl ?? '',
      placeholder: 'Link URL (optional)',
    }) as HTMLInputElement;

    const fileInput = el('input', { type: 'file', accept: 'image/*' }) as HTMLInputElement;

    const saveRow = el('button', { type: 'button', className: 'btn btn-small' }, ['Save']);
    const removeRow = el('button', { type: 'button', className: 'btn btn-small btn-danger' }, ['Remove']);

    saveRow.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      const logoUrl = urlInput.value.trim();
      if (!name || !logoUrl) {
        alert('Sponsor name and logo are required.');
        return;
      }
      config.sponsors[index] = {
        ...sponsor,
        name,
        logoUrl,
        linkUrl: normalizeLinkUrl(linkInput.value),
      };
      await saveConfig();
      renderPreview();
    });

    removeRow.addEventListener('click', async () => {
      if (!confirm(`Remove ${sponsor.name}?`)) return;
      await deleteSponsorLogoByUrl(sponsor.logoUrl);
      config.sponsors.splice(index, 1);
      await saveConfig();
      renderList();
    });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file || !nameInput.value.trim()) {
        alert('Enter sponsor name before uploading.');
        return;
      }
      try {
        const slugs = config.sponsors.map((s) => slugifySponsorName(s.name));
        const logoUrl = await uploadSponsorLogo(file, nameInput.value.trim(), slugs);
        urlInput.value = logoUrl;
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Upload failed');
      }
    });

    row.append(nameInput, urlInput, linkInput, fileInput, saveRow, removeRow);
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
    config = next;
    enabledToggle.checked = config.sponsorsEnabled;
    renderList();
  });

  section.append(enabledLabel, list, addBtn, preview);
  section.addEventListener('DOMNodeRemovedFromDocument', () => unsub());

  return section;
}
