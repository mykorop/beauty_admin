import type { Routes } from '@angular/router';
import type { ProfileCardTab } from '../../shared/profile-card/profile-card';

export const MASTER_CARD_TABS: readonly ProfileCardTab[] = [
  { path: 'profile', labelKey: 'salon.tab.profile' },
  { path: 'schedule', labelKey: 'salonMaster.tab.schedule' },
  { path: 'services', labelKey: 'salon.tab.services' },
  { path: 'appointments', labelKey: 'salon.tab.appointments' },
  { path: 'reviews', labelKey: 'salon.tab.reviews' },
  { path: 'media', labelKey: 'salon.tab.media' },
  { path: 'history', labelKey: 'salon.tab.history' },
];

/** Tabs that already have a screen; every other tab of `MASTER_CARD_TABS` resolves to the stub. */
const IMPLEMENTED: Routes = [
  {
    path: 'profile',
    loadComponent: () => import('./master-profile.tab').then((m) => m.MasterProfileTab),
  },
  {
    path: 'schedule',
    loadComponent: () => import('./master-schedule.tab').then((m) => m.MasterScheduleTab),
  },
  {
    path: 'services',
    loadComponent: () => import('./master-services.tab').then((m) => m.MasterServicesTab),
  },
  {
    path: 'appointments',
    loadComponent: () => import('./master-appointments.tab').then((m) => m.MasterAppointmentsTab),
  },
  {
    path: 'reviews',
    loadComponent: () => import('./master-reviews.tab').then((m) => m.MasterReviewsTab),
  },
  {
    path: 'history',
    loadComponent: () => import('./master-history.tab').then((m) => m.MasterHistoryTab),
  },
];

export const MASTER_CARD_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: MASTER_CARD_TABS[0].path },
  ...MASTER_CARD_TABS.map(
    (tab) =>
      IMPLEMENTED.find((route) => route.path === tab.path) ?? {
        path: tab.path,
        loadComponent: () => import('../../shared/profile-card/card-tab-stub.page').then((m) => m.CardTabStubPage),
      },
  ),
  // A mistyped tab stays on the card instead of falling through to the app's wildcard.
  { path: '**', redirectTo: MASTER_CARD_TABS[0].path },
];
