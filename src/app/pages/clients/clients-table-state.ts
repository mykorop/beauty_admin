import { defaultTableState, type ProfileTableState } from '../../shared/profile-table/profile-table-state';

/**
 * The narrowest of the three profile tables: a Клієнт has neither a locality nor a rating, so the
 * columns are who he is, how to reach him, what state he is in and since when.
 */
export const CLIENT_SORT_FIELDS = ['name', 'email', 'phone', 'status', 'createdAt'] as const;
export type ClientSortField = (typeof CLIENT_SORT_FIELDS)[number];

export type ClientsTableState = ProfileTableState<ClientSortField>;

/** Newest first: the person who registered today is the one a support request is usually about. */
export const DEFAULT_CLIENTS_TABLE_STATE: ClientsTableState =
  defaultTableState<ClientSortField>('createdAt');
