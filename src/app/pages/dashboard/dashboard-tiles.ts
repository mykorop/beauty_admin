import type { BasicStats, ProfileCounts } from '../../core/api/stats.client';
import type { TranslationKey } from '../../i18n/translations';
import type { ProfileStatusFilter } from '../../shared/profile-table/profile-table-state';

/** The four kinds of profile the dashboard counts, in the order it draws them. */
export const STATS_GROUPS = ['salons', 'independentMasters', 'salonMasters', 'clients'] as const;
export type StatsGroupKey = (typeof STATS_GROUPS)[number];

/** The four figures of one group, in the order they are read: how many, and in what state. */
export const STATS_COUNTERS = ['total', 'active', 'blocked', 'deleted'] as const;
export type StatsCounter = (typeof STATS_COUNTERS)[number];

/**
 * Where a group's tiles lead, and what to say when they lead nowhere.
 *
 * One entry rather than two maps, because the two halves are one rule: a group has a list to open
 * **or** a sentence explaining why it has none. Майстри салону are the only group without one — a
 * Майстер салону is reached through the Ростер of his Салон, so there is no platform-wide list to
 * filter, and a link landing somewhere else would be worse than a figure that stays a figure.
 */
const DESTINATION: Record<StatsGroupKey, { path: string | null; hintKey: TranslationKey | null }> = {
  salons: { path: '/salons', hintKey: null },
  independentMasters: { path: '/independent-masters', hintKey: null },
  salonMasters: { path: null, hintKey: 'dashboard.salonMastersHint' },
  clients: { path: '/clients', hintKey: null },
};

/**
 * The state filter each counter stands for.
 *
 * «Усього» counts Видалені, so it has to ask for `all`: the everyday view of a list hides them, and
 * a tile that opens a screen contradicting its own figure teaches the reader to distrust both.
 */
const COUNTER_FILTER: Record<StatsCounter, ProfileStatusFilter> = {
  total: 'all',
  active: 'active',
  blocked: 'blocked',
  deleted: 'deleted',
};

export type DashboardTile = {
  counter: StatsCounter;
  count: number;
  labelKey: TranslationKey;
  /** Router path of the filtered list, or `null` when this kind of profile has no list. */
  path: string | null;
  queryParams: { status: ProfileStatusFilter };
};

export type DashboardGroup = {
  key: StatsGroupKey;
  labelKey: TranslationKey;
  /** What to say instead of a link when the group has no list; `null` when it has one. */
  hintKey: TranslationKey | null;
  tiles: DashboardTile[];
};

/**
 * Базові показники as the screen draws them: one group per kind of profile, four tiles each, and
 * for every tile the address of the list that shows exactly the profiles it counted.
 *
 * Pure, and the whole reason the dashboard has a spec at all: the promise a tile makes — «click me
 * and see these» — is a mapping, and a mapping is worth testing without a browser.
 */
export function dashboardGroups(stats: BasicStats): DashboardGroup[] {
  return STATS_GROUPS.map((key) => ({
    key,
    labelKey: `dashboard.group.${key}` as TranslationKey,
    hintKey: DESTINATION[key].hintKey,
    tiles: tilesOf(stats[key], DESTINATION[key].path),
  }));
}

function tilesOf(counts: ProfileCounts, path: string | null): DashboardTile[] {
  return STATS_COUNTERS.map((counter) => ({
    counter,
    count: counts[counter],
    labelKey: `dashboard.counter.${counter}` as TranslationKey,
    path,
    queryParams: { status: COUNTER_FILTER[counter] },
  }));
}
