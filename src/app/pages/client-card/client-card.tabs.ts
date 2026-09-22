import type { Routes } from '@angular/router';
import type { ProfileCardTab } from '../../shared/profile-card/profile-card';

/**
 * The card of a Клієнт is the shortest of the three, and deliberately: there is no «Каталог», no
 * «Робочий графік» and no edit — a person is not a business. What is here is what answers «що ця
 * людина робила»: who they are, where they booked, what they wrote, and what the platform did.
 */
export const CLIENT_CARD_TABS: readonly ProfileCardTab[] = [
  { path: 'profile', labelKey: 'salon.tab.profile' },
  { path: 'appointments', labelKey: 'salon.tab.appointments' },
  { path: 'reviews', labelKey: 'salon.tab.reviews' },
  { path: 'history', labelKey: 'salon.tab.history' },
];

export const CLIENT_CARD_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: CLIENT_CARD_TABS[0].path },
  {
    path: 'profile',
    loadComponent: () => import('./client-profile.tab').then((m) => m.ClientProfileTab),
  },
  {
    path: 'appointments',
    loadComponent: () => import('./client-appointments.tab').then((m) => m.ClientAppointmentsTab),
  },
  {
    path: 'reviews',
    loadComponent: () => import('./client-reviews.tab').then((m) => m.ClientReviewsTab),
  },
  {
    path: 'history',
    loadComponent: () => import('./client-history.tab').then((m) => m.ClientHistoryTab),
  },
  // A mistyped tab stays on the card instead of falling through to the app's wildcard.
  { path: '**', redirectTo: CLIENT_CARD_TABS[0].path },
];
