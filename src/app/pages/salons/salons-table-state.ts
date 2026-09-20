import type { SalonListItem, SalonStatus } from '../../core/api/salons.client';

export const SALON_SORT_FIELDS = ['name', 'city', 'ownerName', 'rating', 'reviewCount', 'status', 'createdAt'] as const;
export type SalonSortField = (typeof SALON_SORT_FIELDS)[number];

export const SALON_STATUSES: readonly SalonStatus[] = ['active', 'blocked', 'deleted'];
export const PAGE_SIZES: readonly number[] = [25, 50, 100];

/** Everything about the table that the address carries, so a copied link reopens the same view. */
export type SalonsTableState = {
  q: string;
  /** `null` is the everyday view: every salon except Видалені, which only an explicit filter shows. */
  status: SalonStatus | null;
  /** A `cityKeyOf` value: the CUATM code, so one locality spelled two ways is still one filter. */
  city: string | null;
  sort: SalonSortField;
  dir: 'asc' | 'desc';
  /** 1-based. */
  page: number;
  size: number;
};

export const DEFAULT_TABLE_STATE: SalonsTableState = {
  q: '',
  status: null,
  city: null,
  sort: 'createdAt',
  dir: 'desc',
  page: 1,
  size: PAGE_SIZES[0],
};

const includes = <T extends string | number>(values: readonly T[], value: unknown): value is T =>
  values.includes(value as T);

/** An address is user input: anything it does not recognise reads as the default, never as an error. */
export function parseTableState(params: { get(name: string): string | null }): SalonsTableState {
  const status = params.get('status');
  const sort = params.get('sort');
  const dir = params.get('dir');
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));

  return {
    q: params.get('q') ?? DEFAULT_TABLE_STATE.q,
    status: includes(SALON_STATUSES, status) ? status : DEFAULT_TABLE_STATE.status,
    city: params.get('city') || DEFAULT_TABLE_STATE.city,
    sort: includes(SALON_SORT_FIELDS, sort) ? sort : DEFAULT_TABLE_STATE.sort,
    dir: dir === 'asc' || dir === 'desc' ? dir : DEFAULT_TABLE_STATE.dir,
    page: Number.isInteger(page) && page >= 1 ? page : DEFAULT_TABLE_STATE.page,
    size: includes(PAGE_SIZES, size) ? size : DEFAULT_TABLE_STATE.size,
  };
}

/** Only what differs from the default, so the everyday view keeps a bare address. */
export function toQueryParams(state: SalonsTableState): Record<string, string | number> {
  const entries = (Object.keys(DEFAULT_TABLE_STATE) as (keyof SalonsTableState)[])
    .filter((key) => state[key] !== DEFAULT_TABLE_STATE[key])
    .map((key) => [key, state[key] as string | number]);
  return Object.fromEntries(entries);
}

/** Profiles older than the city directory carry a name but no code; the name is then the key. */
export const cityKeyOf = (item: SalonListItem): string => item.cityCode || item.city;

export type CityOption = { key: string; label: string };

/** One option per locality present in the list, labelled by name and ordered for the locale. */
export function cityOptionsOf(items: readonly SalonListItem[], locale: string): CityOption[] {
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

export type SalonsTableView = {
  rows: SalonListItem[];
  /** Rows that passed the search and filters, across all pages. */
  total: number;
  /** The page actually shown: the requested one, pulled back if it lies past the end. */
  page: number;
};

export function applyTableState(
  items: readonly SalonListItem[],
  state: SalonsTableState,
  locale: string,
): SalonsTableView {
  const matchesSearch = searchMatcher(state.q);
  const filtered = items.filter(
    (item) =>
      (state.status === null ? item.status !== 'deleted' : item.status === state.status) &&
      (state.city === null || cityKeyOf(item) === state.city) &&
      matchesSearch(item),
  );

  const compare = comparator(state.sort, locale);
  const direction = state.dir === 'asc' ? 1 : -1;
  // The id settles ties, so equal rows do not trade places between two renders.
  filtered.sort((a, b) => direction * compare(a, b) || a.salonId.localeCompare(b.salonId));

  const page = Math.min(state.page, Math.max(1, Math.ceil(filtered.length / state.size)));
  const first = (page - 1) * state.size;
  return { rows: filtered.slice(first, first + state.size), total: filtered.length, page };
}

const digitsOf = (value: string): string => value.replace(/\D/g, '');

function searchMatcher(q: string): (item: SalonListItem) => boolean {
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

function comparator(field: SalonSortField, locale: string): (a: SalonListItem, b: SalonListItem) => number {
  switch (field) {
    case 'rating':
    case 'reviewCount':
      return (a, b) => a[field] - b[field];
    case 'status':
      return (a, b) => SALON_STATUSES.indexOf(a.status) - SALON_STATUSES.indexOf(b.status);
    case 'createdAt':
      // ISO-8601 in UTC: string order is time order.
      return (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
    default: {
      const collator = new Intl.Collator(locale, { sensitivity: 'base' });
      return (a, b) => collator.compare(a[field], b[field]);
    }
  }
}
