/**
 * The table of every Салон, of every Незалежний майстер and of every Клієнт is the same table: the
 * backend hands over the whole list, and searching, filtering, sorting and paging happen here with
 * the address owning that state. Only the columns differ, so only the columns live in each page.
 */

export type ProfileStatus = 'active' | 'blocked' | 'deleted';

export const PROFILE_STATUSES: readonly ProfileStatus[] = ['active', 'blocked', 'deleted'];

/**
 * What the state filter can be asked for, which is one more thing than a profile can be: `all` is
 * the census view, Видалені included.
 *
 * It exists because the dashboard's «усього» tile counts them and has to open a list that shows the
 * same number — a tile whose figure the screen behind it contradicts is worse than no tile.
 */
export type ProfileStatusFilter = ProfileStatus | 'all';

export const PROFILE_STATUS_FILTERS: readonly ProfileStatusFilter[] = ['all', ...PROFILE_STATUSES];
export const PAGE_SIZES: readonly number[] = [25, 50, 100];

/**
 * What every profile row carries, whatever the profile is: who it is, how to reach them, what state
 * they are in and since when — which is exactly what the search box and the state filter work on.
 *
 * The locality is optional because a Клієнт has none: he is a person with an account, not a place,
 * and his table shows neither the column nor the filter. Rating, review count and everything else a
 * business has live on the page's own row type, not here.
 */
export type ProfileRow = {
  name: string;
  city?: string;
  cityCode?: string;
  email: string;
  phone: string;
  status: ProfileStatus;
  createdAt: string;
};

/** Everything about the table that the address carries, so a copied link reopens the same view. */
export type ProfileTableState<Sort extends string> = {
  q: string;
  /** `null` is the everyday view: every profile except Видалені, which only an explicit filter shows. */
  status: ProfileStatusFilter | null;
  /** A `cityKeyOf` value: the CUATM code, so one locality spelled two ways is still one filter. */
  city: string | null;
  sort: Sort;
  dir: 'asc' | 'desc';
  /** 1-based. */
  page: number;
  size: number;
};

export function defaultTableState<Sort extends string>(sort: Sort): ProfileTableState<Sort> {
  return { q: '', status: null, city: null, sort, dir: 'desc', page: 1, size: PAGE_SIZES[0] };
}

const includes = <T extends string | number>(values: readonly T[], value: unknown): value is T =>
  values.includes(value as T);

/** An address is user input: anything it does not recognise reads as the default, never as an error. */
export function parseProfileTableState<Sort extends string>(
  params: { get(name: string): string | null },
  sortFields: readonly Sort[],
  fallback: ProfileTableState<Sort>,
): ProfileTableState<Sort> {
  const status = params.get('status');
  const sort = params.get('sort');
  const dir = params.get('dir');
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));

  return {
    q: params.get('q') ?? fallback.q,
    status: includes(PROFILE_STATUS_FILTERS, status) ? status : fallback.status,
    city: params.get('city') || fallback.city,
    sort: includes(sortFields, sort) ? sort : fallback.sort,
    dir: dir === 'asc' || dir === 'desc' ? dir : fallback.dir,
    page: Number.isInteger(page) && page >= 1 ? page : fallback.page,
    size: includes(PAGE_SIZES, size) ? size : fallback.size,
  };
}

/** Only what differs from the default, so the everyday view keeps a bare address. */
export function toProfileQueryParams<Sort extends string>(
  state: ProfileTableState<Sort>,
  fallback: ProfileTableState<Sort>,
): Record<string, string | number> {
  const entries = (Object.keys(fallback) as (keyof ProfileTableState<Sort>)[])
    .filter((key) => state[key] !== fallback[key])
    .map((key) => [key, state[key] as string | number]);
  return Object.fromEntries(entries);
}

/** Profiles older than the city directory carry a name but no code; the name is then the key. */
export const cityKeyOf = (item: Pick<ProfileRow, 'city' | 'cityCode'>): string =>
  item.cityCode || item.city || '';

export type CityOption = { key: string; label: string };

/** One option per locality present in the list, labelled by name and ordered for the locale. */
export function cityOptionsOf(
  items: readonly Pick<ProfileRow, 'city' | 'cityCode'>[],
  locale: string,
): CityOption[] {
  const labels = new Map<string, string>();
  for (const item of items) {
    const key = cityKeyOf(item);
    if (key && !labels.has(key)) {
      labels.set(key, item.city || key);
    }
  }
  const collator = new Intl.Collator(locale);
  return [...labels].map(([key, label]) => ({ key, label })).sort((a, b) => collator.compare(a.label, b.label));
}

export type ProfileTableView<Row> = {
  rows: Row[];
  /** Rows that passed the search and filters, across all pages. */
  total: number;
  /** The page actually shown: the requested one, pulled back if it lies past the end. */
  page: number;
};

export type ProfileTableAccessors<Row, Sort extends string> = {
  idOf: (item: Row) => string;
  /**
   * What a column sorts by, when that is not the stored value. A cell showing a translated label
   * must sort by the label the reader sees, not by the code behind it.
   */
  sortValueOf?: (item: Row, field: Sort) => unknown;
};

export function applyProfileTableState<Row extends ProfileRow, Sort extends keyof Row & string>(
  items: readonly Row[],
  state: ProfileTableState<Sort>,
  locale: string,
  { idOf, sortValueOf }: ProfileTableAccessors<Row, Sort>,
): ProfileTableView<Row> {
  const matchesSearch = searchMatcher<Row>(state.q);
  const matchesStatus = statusMatcher(state.status);
  const filtered = items.filter(
    (item) =>
      matchesStatus(item.status) &&
      (state.city === null || cityKeyOf(item) === state.city) &&
      matchesSearch(item),
  );

  const compare = comparator<Row, Sort>(state.sort, locale, sortValueOf);
  const direction = state.dir === 'asc' ? 1 : -1;
  // The id settles ties, so equal rows do not trade places between two renders.
  filtered.sort((a, b) => direction * compare(a, b) || idOf(a).localeCompare(idOf(b)));

  const page = Math.min(state.page, Math.max(1, Math.ceil(filtered.length / state.size)));
  const first = (page - 1) * state.size;
  return { rows: filtered.slice(first, first + state.size), total: filtered.length, page };
}

/** `null` hides Видалені, `all` is the only view that shows them beside everyone else. */
function statusMatcher(filter: ProfileStatusFilter | null): (status: ProfileStatus) => boolean {
  if (filter === null) {
    return (status) => status !== 'deleted';
  }
  if (filter === 'all') {
    return () => true;
  }
  return (status) => status === filter;
}

const digitsOf = (value: string): string => value.replace(/\D/g, '');

function searchMatcher<Row extends ProfileRow>(q: string): (item: Row) => boolean {
  const needle = q.trim().toLocaleLowerCase();
  if (needle === '') {
    return () => true;
  }
  // "(373) 60-111" should find "+37360111…", but only when the query looks like a phone at all.
  const phoneNeedle = /^[\d\s+()-]+$/.test(needle) ? digitsOf(needle) : '';

  return (item) =>
    item.name.toLocaleLowerCase().includes(needle) ||
    item.email.toLocaleLowerCase().includes(needle) ||
    (phoneNeedle !== '' && digitsOf(item.phone).includes(phoneNeedle));
}

function comparator<Row extends ProfileRow, Sort extends keyof Row & string>(
  field: Sort,
  locale: string,
  sortValueOf: ((item: Row, field: Sort) => unknown) | undefined,
): (a: Row, b: Row) => number {
  if (field === 'status') {
    return (a, b) => PROFILE_STATUSES.indexOf(a.status) - PROFILE_STATUSES.indexOf(b.status);
  }
  if (field === 'createdAt') {
    // ISO-8601 in UTC: string order is time order.
    return (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
  }
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  const valueOf = (item: Row): unknown => (sortValueOf ? sortValueOf(item, field) : item[field]);
  return (a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);
    // Numbers sort numerically wherever a column holds them — `rating`, `reviewCount`, a commission.
    return typeof left === 'number' && typeof right === 'number'
      ? left - right
      : collator.compare(String(left ?? ''), String(right ?? ''));
  };
}
