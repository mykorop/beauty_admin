import { defaultTableState, type ProfileTableState } from '../../shared/profile-table/profile-table-state';

export const SALON_SORT_FIELDS = ['name', 'city', 'ownerName', 'rating', 'reviewCount', 'status', 'createdAt'] as const;
export type SalonSortField = (typeof SALON_SORT_FIELDS)[number];

export type SalonsTableState = ProfileTableState<SalonSortField>;

export const DEFAULT_TABLE_STATE: SalonsTableState = defaultTableState<SalonSortField>('createdAt');
