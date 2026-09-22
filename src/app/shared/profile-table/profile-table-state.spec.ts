import type { SalonListItem } from '../../core/api/salons.client';
import { DEFAULT_TABLE_STATE, SALON_SORT_FIELDS, type SalonSortField } from '../../pages/salons/salons-table-state';
import {
  applyProfileTableState,
  cityOptionsOf,
  parseProfileTableState,
  toProfileQueryParams,
  type ProfileTableState,
} from './profile-table-state';

/** Exercised through the Салони table — the one with a column (`ownerName`) all of its own. */
const salon = (overrides: Partial<SalonListItem>): SalonListItem => ({
  salonId: 'id',
  name: 'Salon',
  city: 'Chișinău',
  cityCode: '0100000',
  ownerName: 'Ana Rusu',
  email: 'salon@bookme.md',
  phone: '+37360000000',
  rating: 4,
  reviewCount: 1,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const params = (values: Record<string, string>) => ({
  get: (name: string) => values[name] ?? null,
});
const state = (overrides: Partial<ProfileTableState<SalonSortField>>): ProfileTableState<SalonSortField> => ({
  ...DEFAULT_TABLE_STATE,
  ...overrides,
});
const parse = (values: Record<string, string>) =>
  parseProfileTableState(params(values), SALON_SORT_FIELDS, DEFAULT_TABLE_STATE);
const apply = (
  items: SalonListItem[],
  tableState: ProfileTableState<SalonSortField>,
  sortValueOf?: (item: SalonListItem, field: SalonSortField) => unknown,
) => applyProfileTableState(items, tableState, 'uk-UA', { idOf: (item) => item.salonId, sortValueOf });
const names = (items: SalonListItem[], tableState: ProfileTableState<SalonSortField>): string[] =>
  apply(items, tableState).rows.map((row) => row.name);

describe('profile table state in the address', () => {
  it('is the default when the address carries nothing', () => {
    expect(parse({})).toEqual(DEFAULT_TABLE_STATE);
    expect(toProfileQueryParams(DEFAULT_TABLE_STATE, DEFAULT_TABLE_STATE)).toEqual({});
  });

  it('round-trips every part of the state', () => {
    const full: ProfileTableState<SalonSortField> = {
      q: 'lab',
      status: 'deleted',
      city: '0300000',
      sort: 'rating',
      dir: 'asc',
      page: 3,
      size: 50,
    };

    const query = toProfileQueryParams(full, DEFAULT_TABLE_STATE);

    expect(query).toEqual({
      q: 'lab',
      status: 'deleted',
      city: '0300000',
      sort: 'rating',
      dir: 'asc',
      page: 3,
      size: 50,
    });
    expect(parse(Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)])))).toEqual(full);
  });

  it('falls back to defaults on values it does not know', () => {
    expect(parse({ status: 'banned', sort: 'password', dir: 'sideways', page: '-2', size: '7' })).toEqual(
      DEFAULT_TABLE_STATE,
    );
  });

  it('carries `all` — the census view a dashboard tile links to', () => {
    expect(parse({ status: 'all' }).status).toBe('all');
    expect(toProfileQueryParams(state({ status: 'all' }), DEFAULT_TABLE_STATE)).toEqual({ status: 'all' });
  });
});

describe('profile table rows', () => {
  it('hides Deleted profiles unless the filter asks for them', () => {
    const items = [
      salon({ name: 'Alive' }),
      salon({ name: 'Blocked', status: 'blocked' }),
      salon({ name: 'Gone', status: 'deleted' }),
    ];

    expect(names(items, state({ sort: 'name', dir: 'asc' }))).toEqual(['Alive', 'Blocked']);
    expect(names(items, state({ status: 'deleted' }))).toEqual(['Gone']);
    expect(names(items, state({ status: 'blocked' }))).toEqual(['Blocked']);
    expect(names(items, state({ status: 'active' }))).toEqual(['Alive']);
  });

  it('shows everyone, Видалені included, under `all`', () => {
    const items = [
      salon({ name: 'Alive' }),
      salon({ name: 'Blocked', status: 'blocked' }),
      salon({ name: 'Gone', status: 'deleted' }),
    ];

    expect(names(items, state({ status: 'all', sort: 'name', dir: 'asc' }))).toEqual([
      'Alive',
      'Blocked',
      'Gone',
    ]);
  });

  it('searches by name, email and phone, ignoring case and phone punctuation', () => {
    const items = [
      salon({ name: 'Beauty Lab', email: 'lab@x.md', phone: '+37360111222' }),
      salon({ name: 'Nails', email: 'OWNER@nails.md', phone: '+37369555000' }),
    ];

    expect(names(items, state({ q: 'beauty' }))).toEqual(['Beauty Lab']);
    expect(names(items, state({ q: 'owner@NAILS' }))).toEqual(['Nails']);
    expect(names(items, state({ q: '(373) 60-111' }))).toEqual(['Beauty Lab']);
    expect(names(items, state({ q: '  ' })).length).toBe(2);
  });

  it('filters by city code, so two spellings of one city are one filter', () => {
    const items = [
      salon({ salonId: '1', name: 'A', city: 'Bălți', cityCode: '0300000' }),
      salon({ salonId: '2', name: 'B', city: 'Бельцы', cityCode: '0300000' }),
      salon({ salonId: '3', name: 'C' }),
      salon({ salonId: '4', name: 'Legacy', city: 'Orhei', cityCode: '' }),
    ];

    expect(names(items, state({ city: '0300000', sort: 'name', dir: 'asc' }))).toEqual(['A', 'B']);
    expect(names(items, state({ city: 'Orhei' }))).toEqual(['Legacy']);
    expect(cityOptionsOf(items, 'uk-UA')).toEqual([
      { key: '0300000', label: 'Bălți' },
      { key: '0100000', label: 'Chișinău' },
      { key: 'Orhei', label: 'Orhei' },
    ]);
  });

  it('sorts text by the interface locale and numbers numerically, both ways', () => {
    const items = [
      salon({ salonId: '1', name: 'Яна', rating: 10, reviewCount: 2 }),
      salon({ salonId: '2', name: 'Єва', rating: 9.5, reviewCount: 10 }),
      salon({ salonId: '3', name: 'анна', rating: 2, reviewCount: 1 }),
    ];

    expect(names(items, state({ sort: 'name', dir: 'asc' }))).toEqual(['анна', 'Єва', 'Яна']);
    expect(names(items, state({ sort: 'rating', dir: 'desc' }))).toEqual(['Яна', 'Єва', 'анна']);
    expect(names(items, state({ sort: 'reviewCount', dir: 'asc' }))).toEqual(['анна', 'Яна', 'Єва']);
  });

  it('sorts a translated column by what the reader sees, not by the stored code', () => {
    // What the Незалежні майстри table does with `specialization`: the labels reverse the raw order.
    const labels: Record<string, string> = { 'z-code': 'Абищо', 'a-code': 'Ящірка' };
    const items = [
      salon({ salonId: '1', name: 'Zed', ownerName: 'z-code' }),
      salon({ salonId: '2', name: 'Ann', ownerName: 'a-code' }),
    ];

    const rows = apply(items, state({ sort: 'ownerName', dir: 'asc' }), (item, field) =>
      field === 'ownerName' ? labels[item.ownerName] : item[field],
    ).rows;

    expect(rows.map((row) => row.name)).toEqual(['Zed', 'Ann']);
    // Without the hook the stored codes decide, and the order is the other way round.
    expect(names(items, state({ sort: 'ownerName', dir: 'asc' }))).toEqual(['Ann', 'Zed']);
  });

  it('sorts by registration date, newest first by default', () => {
    const items = [
      salon({ name: 'Old', createdAt: '2025-01-01T00:00:00.000Z' }),
      salon({ name: 'New', createdAt: '2026-06-01T00:00:00.000Z' }),
    ];

    expect(names(items, DEFAULT_TABLE_STATE)).toEqual(['New', 'Old']);
  });

  it('pages the filtered rows and reports their total', () => {
    const items = Array.from({ length: 60 }, (_, i) =>
      salon({ salonId: `${i}`, name: `S${String(i).padStart(2, '0')}` }),
    );

    const second = apply(items, state({ sort: 'name', dir: 'asc', page: 2 }));

    expect(second.total).toBe(60);
    expect(second.page).toBe(2);
    expect(second.rows.length).toBe(25);
    expect(second.rows[0].name).toBe('S25');
  });

  it('lands on the last page when the address asks for one past the end', () => {
    const items = Array.from({ length: 30 }, (_, i) => salon({ salonId: `${i}` }));

    const result = apply(items, state({ page: 9 }));

    expect(result.page).toBe(2);
    expect(result.rows.length).toBe(5);
  });
});
