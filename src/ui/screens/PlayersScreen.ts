import { el } from '@/lib/dom-utils';
import { playerService } from '@/modules/players/PlayerService';
import { usePlayerStore } from '@/stores/playerStore';
import { usePlayersUiStore } from '@/stores/playersUiStore';
import { appRouter } from '@/app/router';
import { renderPlayerCard, PlayerCardOptions } from '@/ui/components/PlayerCard';
import { openPlayerRegistrationModal } from '@/ui/components/PlayerRegistrationModal';
import {
  AppIconId,
  createAppIcon,
  createAppIconLabel,
  genderAppIconId,
  mountAppIcon,
} from '@/ui/icons/app-icons';
import { Player } from '@/types/player';

function refreshPlayersTab(): void {
  appRouter.navigate('players');
}

function getVisiblePlayers(): Player[] {
  const players = usePlayerStore.getState().players;
  const ui = usePlayersUiStore.getState();
  const filtered = playerService.filterPlayers(players, {
    search: ui.searchQuery,
    gender: ui.genderFilter,
    status: ui.statusFilter,
  });
  return playerService.sortPlayers(filtered, ui.sortBy, ui.sortDescending);
}

function createPlayerCardHandlers(): PlayerCardOptions {
  return {
    onEdit: (id) => {
      const target = usePlayerStore.getState().players.find((p) => p.id === id);
      if (!target) return;
      openPlayerRegistrationModal({
        mode: 'edit',
        player: target,
        onClose: () => {},
        onSubmit: (data) => {
          try {
            usePlayerStore.getState().updatePlayer(id, {
              name: data.name,
              gender: data.gender,
              duprDoublesRating: data.duprRating,
            });
            refreshPlayersTab();
          } catch (error) {
            alert(error instanceof Error ? error.message : 'Could not update player');
          }
        },
      });
    },
    onToggleCheckIn: (id) => {
      usePlayerStore.getState().toggleCheckIn(id);
      refreshPlayersTab();
    },
    onExclude: (id) => {
      const target = usePlayerStore.getState().players.find((p) => p.id === id);
      if (!target) return;
      usePlayerStore.getState().setExcluded(id, !target.excluded);
      refreshPlayersTab();
    },
    onRemove: (id) => {
      usePlayerStore.getState().removePlayer(id);
      refreshPlayersTab();
    },
  };
}

/** Re-render list only — keeps search input focused while typing. */
function renderPlayersList(listHost: HTMLElement): void {
  listHost.replaceChildren();
  const players = usePlayerStore.getState().players;
  const visiblePlayers = getVisiblePlayers();

  if (visiblePlayers.length === 0) {
    listHost.append(
      el('p', { className: 'empty-state' }, [
        players.length === 0
          ? 'No players yet. Tap + Add Player to get started.'
          : 'No players match your search or filters.',
      ])
    );
    return;
  }

  for (const player of visiblePlayers) {
    listHost.append(renderPlayerCard(player, createPlayerCardHandlers()));
  }
}

export function renderPlayersScreen(container: HTMLElement): void {
  const players = usePlayerStore.getState().players;
  const ui = usePlayersUiStore.getState();
  const stats = playerService.getRosterStats(players);

  const header = el('div', { className: 'section-header' });
  header.append(el('div', { className: 'section-title' }, ['Players']));

  const addBtn = el('button', { type: 'button', className: 'btn' }, ['+ Add Player']);
  addBtn.addEventListener('click', () => {
    openPlayerRegistrationModal({
      mode: 'add',
      onClose: () => {},
      onSubmit: (data) => {
        try {
          if (data.isBulk && data.names) {
            const result = usePlayerStore
              .getState()
              .bulkAddPlayers(data.names, data.duprRating, data.gender);
            if (result.skipped.length > 0) {
              alert(`Added ${result.added} player(s). Skipped duplicates: ${result.skipped.join(', ')}`);
            }
          } else {
            usePlayerStore.getState().addPlayer(data.name, data.duprRating, data.gender);
          }
          refreshPlayersTab();
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Could not add player');
        }
      },
    });
  });
  header.append(el('div', { className: 'players-header-actions' }, [addBtn]));
  container.append(
    header,
    el('p', { className: 'screen-lead' }, [
      'New players start not checked in. Check them in before they appear in Available Players or Find Match.',
    ])
  );

  const exclusionBar = el('div', { className: 'players-exclusion-bar' });
  const exclusionIcon = el('span', { className: 'players-exclusion-bar__icon' });
  mountAppIcon(exclusionIcon, 'excluded');
  exclusionBar.append(
    el('div', { className: 'players-exclusion-bar__info' }, [
      exclusionIcon,
      el('span', {}, [`${stats.excluded} player(s) excluded`]),
    ])
  );

  const exclusionActions = el('div', { className: 'players-exclusion-bar__actions' });
  const viewBtn = el('button', { type: 'button', className: 'btn btn-small' }, ['View']);
  viewBtn.addEventListener('click', () => {
    usePlayersUiStore.getState().setStatusFilter('excluded');
    refreshPlayersTab();
  });

  const includeAllBtn = el('button', { type: 'button', className: 'btn btn-small btn-success' }, [
    'Include All',
  ]);
  includeAllBtn.addEventListener('click', () => {
    usePlayerStore.getState().includeAllPlayers();
    refreshPlayersTab();
  });

  exclusionActions.append(viewBtn, includeAllBtn);
  exclusionBar.append(exclusionActions);
  container.append(exclusionBar);

  const summaryCard = el('div', { className: 'players-summary card' });
  summaryCard.append(
    el('div', { className: 'players-summary__header' }, [
      el('h3', {}, ['Registered Players']),
      el('span', { className: 'players-summary__badge' }, [`${stats.total} Players`]),
    ]),
    el('div', { className: 'players-summary__stats' }, [
      createAppIconLabel('checked-in', `${stats.active} Checked in`, 'players-summary__stat'),
      createAppIconLabel('not-checked-in', `${stats.checkedOut} Not checked in`, 'players-summary__stat'),
      createAppIconLabel('user-male', `${stats.male} Male`, 'players-summary__stat'),
      createAppIconLabel('user-female', `${stats.female} Female`, 'players-summary__stat'),
      createAppIconLabel('excluded', `${stats.excluded} Excluded`, 'players-summary__stat'),
    ])
  );
  container.append(summaryCard);

  const sortCard = el('div', { className: 'players-sort card' });
  sortCard.append(el('h3', { className: 'players-sort__title' }, ['Sort Players']));

  const sortRow = el('div', { className: 'players-sort__row' });
  sortRow.append(el('label', { className: 'players-sort__label', for: 'players-sort-by' }, ['By:']));
  const sortSelect = el('select', {
    id: 'players-sort-by',
    className: 'players-sort__select',
  }) as HTMLSelectElement;
  const sortOptions: { value: typeof ui.sortBy; label: string }[] = [
    { value: 'name', label: 'Name (A–Z)' },
    { value: 'gender', label: 'Gender' },
    { value: 'skill', label: 'Skill (DUPR Rating)' },
    { value: 'games', label: '# of Games Played' },
    { value: 'wins', label: 'Wins' },
  ];
  for (const option of sortOptions) {
    const opt = el('option', { value: option.value }, [option.label]) as HTMLOptionElement;
    if (ui.sortBy === option.value) opt.selected = true;
    sortSelect.append(opt);
  }
  sortSelect.addEventListener('change', () => {
    usePlayersUiStore.getState().setSortBy(sortSelect.value as typeof ui.sortBy);
    refreshPlayersTab();
  });

  const descLabel = el('label', { className: 'players-sort__desc' });
  const descCheckbox = el('input', { type: 'checkbox' }) as HTMLInputElement;
  descCheckbox.checked = ui.sortDescending;
  descCheckbox.addEventListener('change', () => {
    usePlayersUiStore.getState().setSortDescending(descCheckbox.checked);
    refreshPlayersTab();
  });
  descLabel.append(descCheckbox, ' Descending');
  sortRow.append(sortSelect, descLabel);

  const genderFilterRow = el('div', { className: 'players-filter-row' });
  genderFilterRow.append(el('span', { className: 'players-filter-row__label' }, ['Gender:']));
  for (const filter of ['all', 'male', 'female'] as const) {
    const btn = el(
      'button',
      {
        type: 'button',
        className: `players-filter-btn${ui.genderFilter === filter ? ' players-filter-btn--active' : ''}`,
      },
      []
    );
    if (filter === 'all') {
      btn.textContent = 'All';
    } else {
      btn.append(
        createAppIcon(genderAppIconId(filter)),
        document.createTextNode(` ${filter === 'male' ? 'Male' : 'Female'}`)
      );
    }
    btn.addEventListener('click', () => {
      usePlayersUiStore.getState().setGenderFilter(filter);
      refreshPlayersTab();
    });
    genderFilterRow.append(btn);
  }

  const statusFilterRow = el('div', { className: 'players-filter-row' });
  statusFilterRow.append(el('span', { className: 'players-filter-row__label' }, ['Status:']));
  const statusFilters: { value: typeof ui.statusFilter; label: string; iconId?: AppIconId }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active', iconId: 'active' },
    { value: 'excluded', label: 'Excluded', iconId: 'excluded' },
    { value: 'checked_out', label: 'Not checked in', iconId: 'not-checked-in' },
  ];
  for (const filter of statusFilters) {
    const btn = el(
      'button',
      {
        type: 'button',
        className: `players-filter-btn${ui.statusFilter === filter.value ? ' players-filter-btn--active' : ''}`,
      },
      []
    );
    if (filter.iconId) {
      btn.append(createAppIcon(filter.iconId), document.createTextNode(` ${filter.label}`));
    } else {
      btn.textContent = filter.label;
    }
    btn.addEventListener('click', () => {
      usePlayersUiStore.getState().setStatusFilter(filter.value);
      refreshPlayersTab();
    });
    statusFilterRow.append(btn);
  }

  sortCard.append(sortRow, genderFilterRow, statusFilterRow);
  container.append(sortCard);

  const searchCard = el('div', { className: 'players-search card' });
  searchCard.append(el('h3', { className: 'players-section-label' }, ['Search players']));
  const searchInput = el('input', {
    type: 'search',
    className: 'players-search__input',
    placeholder: 'Search by name…',
    value: ui.searchQuery,
    'aria-label': 'Search players by name',
  }) as HTMLInputElement;

  const list = el('div', { id: 'players-list', className: 'players-list' });
  renderPlayersList(list);

  searchInput.addEventListener('input', () => {
    usePlayersUiStore.getState().setSearchQuery(searchInput.value);
    renderPlayersList(list);
  });
  searchCard.append(searchInput);
  container.append(searchCard, list);
}
