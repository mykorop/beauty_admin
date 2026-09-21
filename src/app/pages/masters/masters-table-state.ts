import { defaultTableState, type ProfileTableState } from '../../shared/profile-table/profile-table-state';

/** The Салон's `ownerName` column has no counterpart here; a Майстер is sorted by his craft. */
export const MASTER_SORT_FIELDS = [
  'name',
  'city',
  'specialization',
  'rating',
  'reviewCount',
  'status',
  'createdAt',
] as const;
export type MasterSortField = (typeof MASTER_SORT_FIELDS)[number];

export type MastersTableState = ProfileTableState<MasterSortField>;

export const DEFAULT_MASTERS_TABLE_STATE: MastersTableState =
  defaultTableState<MasterSortField>('createdAt');
