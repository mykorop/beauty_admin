import type { BasicStats } from '../../core/api/stats.client';
import { applyProfileTableState, type ProfileStatusFilter } from '../../shared/profile-table/profile-table-state';
import { DEFAULT_TABLE_STATE } from '../salons/salons-table-state';
import { dashboardGroups, STATS_COUNTERS, type StatsGroupKey } from './dashboard-tiles';

const counts = (total: number, active: number, blocked: number, deleted: number) => ({
  total,
  active,
  blocked,
  deleted,
});

const STATS: BasicStats = {
  builtAt: '2026-09-20T10:00:00.000Z',
  salons: counts(42, 38, 1, 3),
  independentMasters: counts(17, 15, 0, 2),
  salonMasters: counts(96, 90, 2, 4),
  clients: counts(1204, 1190, 4, 10),
};

const groupOf = (key: StatsGroupKey) => dashboardGroups(STATS).find((group) => group.key === key)!;
const tileOf = (key: StatsGroupKey, counter: string) =>
  groupOf(key).tiles.find((tile) => tile.counter === counter)!;

describe('dashboard tiles', () => {
  it('draws one group per kind of profile, four figures each', () => {
    expect(dashboardGroups(STATS).map((group) => group.key)).toEqual([
      'salons',
      'independentMasters',
      'salonMasters',
      'clients',
    ]);
    expect(groupOf('salons').tiles.map((tile) => tile.count)).toEqual([42, 38, 1, 3]);
    expect(groupOf('clients').tiles.map((tile) => tile.counter)).toEqual([...STATS_COUNTERS]);
  });

  it('sends every tile to the list of its own kind of profile', () => {
    expect(tileOf('salons', 'blocked').path).toBe('/salons');
    expect(tileOf('independentMasters', 'active').path).toBe('/independent-masters');
    expect(tileOf('clients', 'deleted').path).toBe('/clients');
  });

  it('carries the filter that leaves exactly the profiles it counted', () => {
    expect(tileOf('salons', 'active').queryParams).toEqual({ status: 'active' });
    expect(tileOf('salons', 'blocked').queryParams).toEqual({ status: 'blocked' });
    expect(tileOf('salons', 'deleted').queryParams).toEqual({ status: 'deleted' });
    // Видалені are in the figure, so the list behind it must show them too.
    expect(tileOf('salons', 'total').queryParams).toEqual({ status: 'all' });
  });

  it('leaves Майстри салону as figures: the panel has no list of them to open', () => {
    expect(groupOf('salonMasters').tiles.every((tile) => tile.path === null)).toBe(true);
    expect(groupOf('salonMasters').hintKey).toBe('dashboard.salonMastersHint');
    expect(groupOf('salons').hintKey).toBeNull();
  });

  it('labels every group and every figure', () => {
    expect(groupOf('independentMasters').labelKey).toBe('dashboard.group.independentMasters');
    expect(tileOf('clients', 'blocked').labelKey).toBe('dashboard.counter.blocked');
  });

  /**
   * The promise of a tile, checked end to end against the table it opens: the filter it carries,
   * run over a list of known states, must leave exactly as many rows as the tile claimed.
   */
  it('opens a list holding exactly as many profiles as the tile shows', () => {
    const salon = (status: 'active' | 'blocked' | 'deleted', salonId: string) => ({
      salonId,
      name: salonId,
      city: '',
      cityCode: '',
      ownerName: '',
      email: '',
      phone: '',
      rating: 0,
      reviewCount: 0,
      status,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const items = [
      salon('active', 's1'),
      salon('active', 's2'),
      salon('blocked', 's3'),
      salon('deleted', 's4'),
    ];
    const stats: BasicStats = { ...STATS, salons: counts(4, 2, 1, 1) };
    const shown = (status: ProfileStatusFilter) =>
      applyProfileTableState(items, { ...DEFAULT_TABLE_STATE, status }, 'uk-UA', {
        idOf: (item: { salonId: string }) => item.salonId,
      }).total;

    for (const tile of dashboardGroups(stats)[0].tiles) {
      expect(shown(tile.queryParams.status))
        .withContext(`«${tile.counter}» tile of the Салони`)
        .toBe(tile.count);
    }
  });
});
