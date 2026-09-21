import type { Routes } from '@angular/router';
import type { ProfileCardTab } from '../../shared/profile-card/profile-card';

export const SALON_CARD_TABS: readonly ProfileCardTab[] = [
  { path: 'profile', labelKey: 'salon.tab.profile' },
  { path: 'hours', labelKey: 'salon.tab.hours' },
  { path: 'roster', labelKey: 'salon.tab.roster' },
  { path: 'services', labelKey: 'salon.tab.services' },
  { path: 'appointments', labelKey: 'salon.tab.appointments' },
  { path: 'reviews', labelKey: 'salon.tab.reviews' },
  { path: 'media', labelKey: 'salon.tab.media' },
  { path: 'invites', labelKey: 'salon.tab.invites' },
  { path: 'history', labelKey: 'salon.tab.history' },
];

/** Tabs that already have a screen; every other tab of `SALON_CARD_TABS` resolves to the stub. */
const IMPLEMENTED: Routes = [
  {
    path: 'profile',
    loadComponent: () => import('./salon-profile.tab').then((m) => m.SalonProfileTab),
  },
  {
    path: 'hours',
    loadComponent: () => import('./salon-hours.tab').then((m) => m.SalonHoursTab),
  },
  {
    path: 'roster',
    loadComponent: () => import('./salon-roster.tab').then((m) => m.SalonRosterTab),
  },
  {
    path: 'invites',
    loadComponent: () => import('./salon-invites.tab').then((m) => m.SalonInvitesTab),
  },
  {
    path: 'history',
    loadComponent: () => import('./salon-history.tab').then((m) => m.SalonHistoryTab),
  },
];

export const SALON_CARD_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: SALON_CARD_TABS[0].path },
  ...SALON_CARD_TABS.map(
    (tab) =>
      IMPLEMENTED.find((route) => route.path === tab.path) ?? {
        path: tab.path,
        loadComponent: () =>
          import('../../shared/profile-card/card-tab-stub.page').then((m) => m.CardTabStubPage),
      },
  ),
  // A mistyped tab stays on the card instead of falling through to the app's wildcard.
  { path: '**', redirectTo: SALON_CARD_TABS[0].path },
];
