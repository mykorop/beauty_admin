import type { Routes } from '@angular/router';
import type { ProfileCardTab } from '../../shared/profile-card/profile-card';

export const SALON_MASTER_CARD_TABS: readonly ProfileCardTab[] = [
  { path: 'profile', labelKey: 'salonMaster.tab.profile' },
  { path: 'schedule', labelKey: 'salonMaster.tab.schedule' },
  { path: 'services', labelKey: 'salonMaster.tab.services' },
  { path: 'appointments', labelKey: 'salonMaster.tab.appointments' },
  { path: 'reviews', labelKey: 'salonMaster.tab.reviews' },
];

/** Tabs that already have a screen; every other tab of `SALON_MASTER_CARD_TABS` resolves to the stub. */
const IMPLEMENTED: Routes = [
  {
    path: 'profile',
    loadComponent: () => import('./salon-master-profile.tab').then((m) => m.SalonMasterProfileTab),
  },
];

export const SALON_MASTER_CARD_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: SALON_MASTER_CARD_TABS[0].path },
  ...SALON_MASTER_CARD_TABS.map(
    (tab) =>
      IMPLEMENTED.find((route) => route.path === tab.path) ?? {
        path: tab.path,
        loadComponent: () => import('../../shared/profile-card/card-tab-stub.page').then((m) => m.CardTabStubPage),
      },
  ),
  // A mistyped tab stays on the card instead of falling through to the app's wildcard.
  { path: '**', redirectTo: SALON_MASTER_CARD_TABS[0].path },
];
